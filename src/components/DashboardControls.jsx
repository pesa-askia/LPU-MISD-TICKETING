import { useState } from "react";
import { Search, ChevronDown, CircleDot, CheckCircle } from "lucide-react";

const ICON_MAP = {
  "Open Tickets": CircleDot,
  "Closed Tickets": CheckCircle,
};

export const FilterSelect = ({ value, onChange, options }) => {
  const LeftIcon = ICON_MAP[value] || CircleDot;

  return (
    <div className="relative flex-1 group">
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

// Fires onSearch(value) on Enter key press or Search button click.
// Parent receives only the committed search value, not every keystroke.
export const SearchInput = ({
  onSearch,
  placeholder = "Search...",
  defaultValue = "",
}) => {
  const [value, setValue] = useState(defaultValue);

  const commit = () => onSearch(value);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
  };

  return (
    <div className="flex-1 min-w-0 w-full flex items-center border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 focus-within:ring-2 focus-within:ring-lpu-gold focus-within:border-lpu-gold bg-white">
      <Search
        size={18}
        className="shrink-0 ml-3 md:ml-4 text-gray-400 stroke-[2.2px]"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value === "") onSearch("");
        }}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 w-full px-2 md:px-3 py-3 bg-transparent text-[0.95rem] font-medium outline-none text-ellipsis"
      />
      <button
        type="button"
        onClick={commit}
        className="shrink-0 px-4 md:px-5 py-2 mr-1.5 bg-lpu-maroon text-white text-sm font-semibold rounded-lg hover:bg-lpu-red transition-colors"
      >
        Search
      </button>
    </div>
  );
};
