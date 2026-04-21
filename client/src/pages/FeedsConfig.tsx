import { trpc } from "@/lib/trpc";
import { CategoryBadge, CATEGORY_CONFIG, type Category } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Rss, Plus, Trash2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];

export default function FeedsConfig() {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("geral");
  const [isAdding, setIsAdding] = useState(false);

  const utils = trpc.useUtils();

  const { data: feeds, isLoading } = trpc.feeds.list.useQuery();

  const addMutation = trpc.feeds.add.useMutation({
    onSuccess: () => {
      toast.success("Feed adicionado com sucesso!");
      setNewName("");
      setNewUrl("");
      setNewCategory("geral");
      utils.feeds.list.invalidate();
    },
    onError: (err) => toast.error(`Erro ao adicionar feed: ${err.message}`),
  });

  const toggleMutation = trpc.feeds.toggleActive.useMutation({
    onSuccess: () => utils.feeds.list.invalidate(),
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.feeds.delete.useMutation({
    onSuccess: () => {
      toast.success("Feed removido com sucesso!");
      utils.feeds.list.invalidate();
    },
    onError: (err) => toast.error(`Erro ao remover feed: ${err.message}`),
  });

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      toast.error("Preencha o nome e a URL do feed.");
      return;
    }
    try {
      new URL(newUrl);
    } catch {
      toast.error("URL inválida. Verifique o formato.");
      return;
    }
    setIsAdding(true);
    try {
      await addMutation.mutateAsync({ name: newName.trim(), url: newUrl.trim(), category: newCategory });
    } finally {
      setIsAdding(false);
    }
  };

  const activeFeeds = feeds?.filter((f) => f.active) ?? [];
  const inactiveFeeds = feeds?.filter((f) => !f.active) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração de Feeds</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as fontes RSS monitoradas pelo painel
        </p>
      </div>

      {/* Add new feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            Adicionar novo feed RSS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="feed-name" className="text-xs">Nome da fonte</Label>
              <Input
                id="feed-name"
                placeholder="Ex: Notícias Agrícolas"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="feed-url" className="text-xs">URL do feed RSS</Label>
              <Input
                id="feed-url"
                placeholder="https://exemplo.com.br/rss"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={newCategory}
                onValueChange={(v) => setNewCategory(v as Category)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_CONFIG[cat].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleAdd}
            disabled={isAdding || !newName || !newUrl}
          >
            <Plus className="h-4 w-4" />
            Adicionar feed
          </Button>
        </CardContent>
      </Card>

      {/* Feed list */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Rss className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Feeds configurados
          </h2>
          {feeds && (
            <Badge variant="secondary" className="text-xs">
              {activeFeeds.length} ativos / {feeds.length} total
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : feeds && feeds.length > 0 ? (
          <div className="space-y-2">
            {[...activeFeeds, ...inactiveFeeds].map((feed) => (
              <div
                key={feed.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  feed.active
                    ? "border-border bg-card"
                    : "border-border/50 bg-muted/30 opacity-60"
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {feed.fetchErrorCount > 3 ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : feed.active ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Feed info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{feed.name}</span>
                    <CategoryBadge category={feed.category} />
                    {feed.fetchErrorCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {feed.fetchErrorCount} erro{feed.fetchErrorCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{feed.url}</p>
                  {feed.lastFetchedAt && (
                    <p className="text-xs text-muted-foreground">
                      Última busca:{" "}
                      {formatDistanceToNow(new Date(feed.lastFetchedAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {feed.active ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={feed.active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: feed.id, active: checked })
                      }
                    />
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover feed?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso removerá o feed <strong>{feed.name}</strong> e todos os artigos
                          associados. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: feed.id })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <Rss className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum feed configurado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
