import React from 'react';
import { Bell, Search, User, LogOut, FileText } from 'lucide-react';

export const Header = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed w-full top-0 z-50">
      <div className="flex items-center gap-2">
        <FileText className="w-6 h-6 text-primary" />
        <span className="text-lg font-bold text-gray-800">CIC DocFlow</span>
      </div>

      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию или статусу"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>

        <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 pr-2 rounded-full border border-transparent hover:border-gray-200 transition-all">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-sm">
            JD
          </div>
          <span className="text-sm font-medium text-gray-700">John Doe</span>
        </div>
      </div>
    </header>
  );
};
