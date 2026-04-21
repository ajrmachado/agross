import { cn } from "@/lib/utils";

export type Category =
  | "mercado"
  | "commodities"
  | "clima"
  | "politica_agricola"
  | "tecnologia"
  | "internacional"
  | "geral";

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; className: string }
> = {
  mercado: {
    label: "Mercado",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  commodities: {
    label: "Commodities",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  clima: {
    label: "Clima",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  },
  politica_agricola: {
    label: "Política Agrícola",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  tecnologia: {
    label: "Tecnologia",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  internacional: {
    label: "Internacional",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  geral: {
    label: "Geral",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

interface CategoryBadgeProps {
  category: Category | string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category as Category] ?? CATEGORY_CONFIG.geral;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export { CATEGORY_CONFIG };
