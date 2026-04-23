import { Search, ChevronDown, CircleDot, CheckCircle } from "lucide-react";

const ICON_MAP = {
  "Open Tickets": CircleDot,
  "Closed Tickets": CheckCircle,
};

// FilterSelect: Dropdown select with dynamic left icon for dashboard filters
export const FilterSelect = ({ value, onChange, options }) => {
  // Look up the icon based on the current value, default to CircleDot
  const LeftIcon = ICON_MAP[value] || CircleDot;

  return (
    <div className="relative flex-1 group">
      {/* Left Icon: Automatically switches based on 'value' */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-colors duration-200 group-focus-within:text-lpu-gold">
        <LeftIcon size={18} className="stroke-[2.2px]" />
      </div>

      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-[0.95rem] font-bold text-gray-700 outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold cursor-pointer"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        size={18}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-all duration-200 group-focus-within:rotate-180 group-focus-within:text-lpu-gold"
      />
    </div>
  );
};

// SearchInput: Search field with left search icon for dashboard filtering
export const SearchInput = ({ value, onChange, placeholder = "Search..." }) => {
  return (
    <div className="relative flex-1 group">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors duration-200 group-focus-within:text-lpu-gold stroke-[2.2px]"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-[0.95rem] font-medium outline-none transition-all duration-200 focus:ring-2 focus:ring-lpu-gold focus:border-lpu-gold"
      />
    </div>
  );
};
