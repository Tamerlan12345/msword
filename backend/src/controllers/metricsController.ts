import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getMetrics = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    // 1. Determine Date Range
    // Default: Current Month
    const now = new Date();
    const startDate = start ? new Date(String(start)) : new Date(now.getFullYear(), now.getMonth(), 1);

    let endDate;
    if (end) {
        endDate = new Date(String(end));
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // 2. Fetch Data
    // A. Documents created in range (for Volume Dynamics & Summary Total)
    const documents = await prisma.document.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    // B. Completed Approvals in range (for Dept/User Performance)
    // We look for tasks *completed* in this period to calculate performance.
    const completedApprovals = await prisma.documentApprover.findMany({
      where: {
        actionDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            firstname: true,
            patronymic: true,
            department: true,
          },
        },
      },
    });

    // C. Current Bottlenecks (Snapshot - ignoring date range for this specific metric,
    // or maybe we want to see bottlenecks *at that time*? No, bottlenecks are usually "Right Now")
    // The prompt says "currently piled up". So we ignore the date filter for bottlenecks.
    const currentBottlenecks = await prisma.documentApprover.findMany({
      where: {
        status: 'PENDING',
        isCurrent: true, // Only count if it's actually waiting on them
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            firstname: true,
            patronymic: true,
            department: true,
          },
        },
        document: {
          select: {
            title: true,
            createdAt: true,
          }
        }
      },
    });

    // 3. Aggregate Data

    // --- Summary Cards ---
    const summary = {
      totalSent: documents.length,
      approved: documents.filter(d => d.status === 'APPROVED').length,
      rejected: documents.filter(d => d.status === 'REJECTED').length,
      onApproval: documents.filter(d => d.status === 'ON_APPROVAL').length,
    };

    // --- Dynamics (Documents created per day) ---
    const dynamicsMap: Record<string, number> = {};
    documents.forEach(doc => {
      const day = doc.createdAt.toISOString().split('T')[0];
      dynamicsMap[day] = (dynamicsMap[day] || 0) + 1;
    });
    const dynamics = Object.entries(dynamicsMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- Department & User Metrics ---
    // Structure: { [deptName]: { total: 0, approved: 0, rejected: 0, times: [], users: { [userId]: { ... } } } }
    const deptMap: Record<string, any> = {};

    completedApprovals.forEach(task => {
      const dept = task.user.department || 'Unknown';
      const userName = [task.user.surname, task.user.firstname, task.user.patronymic].filter(Boolean).join(' ') || task.user.name || 'Unknown';
      const userId = task.user.id;

      if (!deptMap[dept]) {
        deptMap[dept] = {
          name: dept,
          total: 0,
          approved: 0,
          rejected: 0,
          times: [], // array of durations in ms
          users: {},
        };
      }

      if (!deptMap[dept].users[userId]) {
        deptMap[dept].users[userId] = {
          id: userId,
          name: userName,
          total: 0,
          approved: 0,
          rejected: 0,
          times: [],
        };
      }

      // Counts
      deptMap[dept].total++;
      if (task.status === 'APPROVED') deptMap[dept].approved++;
      if (task.status === 'REJECTED') deptMap[dept].rejected++;

      deptMap[dept].users[userId].total++;
      if (task.status === 'APPROVED') deptMap[dept].users[userId].approved++;
      if (task.status === 'REJECTED') deptMap[dept].users[userId].rejected++;

      // Time Calculation
      if (task.actionDate && task.assignedAt) {
        const duration = new Date(task.actionDate).getTime() - new Date(task.assignedAt).getTime();
        if (duration >= 0) {
          deptMap[dept].times.push(duration);
          deptMap[dept].users[userId].times.push(duration);
        }
      }
    });

    // Helper to calculate avg/min/max
    const calcStats = (times: number[]) => {
      if (times.length === 0) return { avg: 0, min: 0, max: 0 };
      const sum = times.reduce((a, b) => a + b, 0);
      const avg = sum / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      return { avg, min, max };
    };

    // Format Output
    const departments = Object.values(deptMap).map((d: any) => {
      const dStats = calcStats(d.times);

      const users = Object.values(d.users).map((u: any) => {
        const uStats = calcStats(u.times);
        return {
          ...u,
          avgTime: uStats.avg,
          minTime: uStats.min,
          maxTime: uStats.max,
          // Remove raw times array from output
          times: undefined
        };
      });

      return {
        name: d.name,
        total: d.total,
        approved: d.approved,
        rejected: d.rejected,
        avgTime: dStats.avg,
        users,
      };
    });

    // --- Bottlenecks ---
    // Top users with pending tasks
    const bottleneckMap: Record<string, any> = {};
    currentBottlenecks.forEach(task => {
        const userId = task.user.id;
        if (!bottleneckMap[userId]) {
            const userName = [task.user.surname, task.user.firstname, task.user.patronymic].filter(Boolean).join(' ') || task.user.name || 'Unknown';
            bottleneckMap[userId] = {
                id: userId,
                name: userName,
                department: task.user.department || 'Unknown',
                count: 0,
                tasks: [] // Optional: list task titles?
            };
        }
        bottleneckMap[userId].count++;
    });

    const bottlenecks = Object.values(bottleneckMap)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5); // Top 5

    res.json({
      summary,
      dynamics,
      departments,
      bottlenecks,
      range: { start: startDate, end: endDate }
    });

  } catch (error) {
    console.error('Metrics Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};
