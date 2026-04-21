import { ExternalLink, Clock, Newspaper } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ArticleCardProps {
  title: string;
  description?: string | null;
  link?: string | null;
  source: string;
  category: string;
  publishedAt?: Date | string | null;
}

export function ArticleCard({
  title,
  description,
  link,
  source,
  category,
  publishedAt,
}: ArticleCardProps) {
  const pubDate = publishedAt ? new Date(publishedAt) : null;
  const timeAgo = pubDate
    ? formatDistanceToNow(pubDate, { addSuffix: true, locale: ptBR })
    : null;

  return (
    <article className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={category} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Newspaper className="h-3 w-3" />
            {source}
          </span>
        </div>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
            title="Abrir artigo"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
        ) : (
          title
        )}
      </h3>

      {description && (
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {description}
        </p>
      )}

      {timeAgo && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto pt-1">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
      )}
    </article>
  );
}
