import { trpc } from "@/lib/trpc";
import { PaywallGate } from "@/components/PaywallGate";
import { ArticleCard } from "@/components/ArticleCard";
import { CategoryBadge, CATEGORY_CONFIG, type Category } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Newspaper, Filter, X, ChevronLeft, ChevronRight, Search, Calendar } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];
const PAGE_SIZE = 24;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function Articles() {
  const [selectedFeedIds, setSelectedFeedIds] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: feeds } = trpc.feeds.list.useQuery();

  const queryInput = useMemo(
    () => ({
      feedIds: selectedFeedIds.length > 0 ? selectedFeedIds : undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      search: debouncedSearch.trim().length > 0 ? debouncedSearch.trim() : undefined,
      dateFrom: dateFrom ? new Date(dateFrom + "T00:00:00") : undefined,
      dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [selectedFeedIds, selectedCategories, debouncedSearch, dateFrom, dateTo, page]
  );

  const { data, isLoading } = trpc.articles.list.useQuery(queryInput);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const toggleCategory = (cat: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setPage(0);
  };

  const toggleFeed = (feedId: number) => {
    setSelectedFeedIds((prev) =>
      prev.includes(feedId) ? prev.filter((id) => id !== feedId) : [...prev, feedId]
    );
    setPage(0);
  };

  const clearFilters = () => {
    setSelectedFeedIds([]);
    setSelectedCategories([]);
    setSearchInput("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const hasDateFilter = dateFrom.length > 0 || dateTo.length > 0;
  const hasFilters = selectedFeedIds.length > 0 || selectedCategories.length > 0 || debouncedSearch.trim().length > 0 || hasDateFilter;

  return (
    <PaywallGate minPlan="morning_call" featureName="Artigos do Agronegócio" description="Acesse notícias de +20 fontes especializadas, com filtros por categoria, data e feed.">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Artigos</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (
              <>
                <span className="font-medium text-foreground">{data.total.toLocaleString("pt-BR")}</span> artigos encontrados
              </>
            ) : (
              "Carregando..."
            )}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por palavra-chave (ex: soja, USDA, crédito rural)..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchInput.length > 0 && (
          <button
            onClick={() => setSearchInput("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs">
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Category filters */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`transition-opacity ${
                  selectedCategories.includes(cat) ? "opacity-100 ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"
                } rounded-full`}
              >
                <CategoryBadge category={cat} />
              </button>
            ))}
          </div>
        </div>

        {/* Date range filters */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Período
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                max={dateTo || undefined}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                min={dateFrom || undefined}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {hasDateFilter && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Limpar datas
              </button>
            )}
          </div>
        </div>

        {/* Source filters */}
        {feeds && feeds.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte</p>
            <div className="flex flex-wrap gap-2">
              {feeds
                .filter((f) => f.active)
                .map((feed) => (
                  <button
                    key={feed.id}
                    onClick={() => toggleFeed(feed.id)}
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      selectedFeedIds.includes(feed.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {feed.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {debouncedSearch.trim().length > 0 && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => setSearchInput("")}
            >
              <Search className="h-3 w-3" />
              "{debouncedSearch.trim()}"
              <X className="h-3 w-3" />
            </Badge>
          )}
          {selectedCategories.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => toggleCategory(cat)}
            >
              <CategoryBadge category={cat} />
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedFeedIds.map((id) => {
            const feed = feeds?.find((f) => f.id === id);
            return feed ? (
              <Badge
                key={id}
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={() => toggleFeed(id)}
              >
                {feed.name}
                <X className="h-3 w-3" />
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {/* Articles Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((article) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                description={article.description}
                link={article.link}
                source={article.source}
                category={article.category}
                publishedAt={article.publishedAt}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <Newspaper className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {hasFilters ? "Nenhum artigo encontrado com esses filtros." : "Nenhum artigo coletado ainda."}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
    </PaywallGate>
  );
}
