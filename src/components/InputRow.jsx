import React from 'react';

const InputRow = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="flex flex-col gap-2">
    <label className="font-medium text-sm text-slate-700 dark:text-slate-300">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    />
  </div>
);

export default InputRow;
