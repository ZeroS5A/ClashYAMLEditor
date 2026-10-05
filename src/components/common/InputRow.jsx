import React, { useId } from 'react';

const InputRow = ({ label, value, onChange, type = "text", placeholder }) => {
  const id = useId();
  return (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="font-medium text-sm text-slate-700 dark:text-slate-300">{label}</label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      className="p-3 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    />
  </div>
);
};

export default InputRow;
