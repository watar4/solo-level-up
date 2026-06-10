import type { Category } from '../types/question';

const COLORS: Record<Category, string> = {
  データサイエンス力: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  データエンジニアリング力: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  ビジネス力: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  '数理・データサイエンス・AIリテラシー': 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
};

export function categoryColor(category: Category): string {
  return COLORS[category];
}

export default function CategoryBadge({ category }: { category: Category }) {
  return <span className={`chip ${COLORS[category]}`}>{category}</span>;
}
