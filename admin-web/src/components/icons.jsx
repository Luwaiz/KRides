// Minimal stroke-style icons, no icon library — keeps the bundle small and
// every icon the same visual weight (1.6 stroke, rounded caps/joins).
const base = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

export function PayoutsIcon(props) {
    return (
        <svg {...base} {...props}>
            <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
            <path d="M2.5 10.5h19" />
            <path d="M6 15h4" />
        </svg>
    );
}

export function RefundIcon(props) {
    return (
        <svg {...base} {...props}>
            <path d="M4 12a8 8 0 1 1 2.6 5.9" />
            <path d="M4 12V6" />
            <path d="M4 12h6" />
        </svg>
    );
}

export function AddDriverIcon(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
            <path d="M18 8v6" />
            <path d="M15 11h6" />
        </svg>
    );
}

export function ReportIcon(props) {
    return (
        <svg {...base} {...props}>
            <path d="M5 3v18" />
            <path d="M5 4h13l-3 4 3 4H5" />
        </svg>
    );
}

export function OrphanedIcon(props) {
    return (
        <svg {...base} {...props}>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4.5" />
            <path d="M12 17.2v.1" />
        </svg>
    );
}

export function LogoutIcon(props) {
    return (
        <svg {...base} {...props}>
            <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
            <path d="M16 16l4-4-4-4" />
            <path d="M20 12H9" />
        </svg>
    );
}

export function SearchIcon(props) {
    return (
        <svg {...base} width={16} height={16} {...props}>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M20 20l-4.35-4.35" />
        </svg>
    );
}
