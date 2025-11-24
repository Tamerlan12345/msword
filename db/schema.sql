-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ROLES
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, -- 'admin', 'user', 'manager'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    password_hash VARCHAR(255), -- Nullable if using external auth provider
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. WORKFLOW DEFINITIONS
CREATE TABLE public.workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE approval_type_enum AS ENUM ('any', 'all'); -- 'any' = one person approves, 'all' = everyone must approve

CREATE TABLE public.workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,

    -- Configuration for parallel approval
    approval_type approval_type_enum DEFAULT 'any',
    time_limit_hours INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, step_order)
);

-- Many-to-Many for Step Approvers (Supports Parallel Approval)
-- A step can be assigned to multiple specific users AND/OR multiple roles
CREATE TABLE public.workflow_step_approvers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_id UUID REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    approver_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Specific user
    approver_role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE, -- Or any user with this role
    CHECK (approver_user_id IS NOT NULL OR approver_role_id IS NOT NULL)
);

-- 3. DOCUMENTS
CREATE TYPE document_status AS ENUM ('draft', 'in_progress', 'approved', 'rejected', 'archived');

CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.users(id) NOT NULL,
    current_status document_status DEFAULT 'draft',

    -- Workflow State
    active_workflow_instance_id UUID, -- Will point to workflow_instances

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. DOCUMENT VERSIONS
CREATE TABLE public.document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64),
    changes_summary TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- 5. WORKFLOW INSTANCES (Running Processes)
CREATE TYPE workflow_instance_status AS ENUM ('active', 'completed', 'terminated');

CREATE TABLE public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    workflow_definition_id UUID REFERENCES public.workflow_definitions(id),
    current_step_order INTEGER DEFAULT 1,
    status workflow_instance_status DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Update circular reference in documents
ALTER TABLE public.documents
ADD CONSTRAINT fk_active_workflow
FOREIGN KEY (active_workflow_instance_id)
REFERENCES public.workflow_instances(id)
ON DELETE SET NULL;

-- 6. PENDING APPROVALS (For Parallel Tracking)
-- Tracks who specifically needs to approve the *current* step of an instance
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.instance_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    step_id UUID REFERENCES public.workflow_steps(id),
    approver_user_id UUID REFERENCES public.users(id),
    status approval_status DEFAULT 'pending',
    comment TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AUDIT LOGS
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
