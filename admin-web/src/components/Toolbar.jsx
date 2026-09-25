import { SearchIcon } from './icons';

export default function Toolbar({ search, onSearchChange, searchPlaceholder, filter }) {
    return (
        <div className="toolbar">
            <div className="search-box">
                <SearchIcon />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder || 'Search…'}
                />
            </div>
            {filter && (
                <select value={filter.value} onChange={(e) => filter.onChange(e.target.value)}>
                    {filter.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            )}
        </div>
    );
}
