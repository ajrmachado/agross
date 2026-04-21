import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  Image as ImageIcon,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Linkedin,
  AlertCircle,
  MessageCircle,
  Mail,
  Download,
} from "lucide-react";

type ApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected";

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  draft: { label: "Rascunho", variant: "secondary", color: "text-gray-500" },
  pending_approval: { label: "Aguardando Aprovação", variant: "default", color: "text-amber-600" },
  approved: { label: "Aprovado", variant: "default", color: "text-emerald-600" },
  rejected: { label: "Rejeitado", variant: "destructive", color: "text-red-600" },
};

function LinkedInPostPreview({ post }: { post: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = post.split("\n");
  const preview = lines.slice(0, 4).join("\n");
  const isLong = lines.length > 4;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* LinkedIn header mockup */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          TL
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm">Thiago Lucena</p>
          <p className="text-xs text-gray-500 truncate">
            Especialista em Estratégia Financeira no Agro | PL Capital
          </p>
          <p className="text-xs text-gray-400">Agora • 🌐</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
          {expanded || !isLong ? post : preview + "\n..."}
        </pre>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> Ver menos</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> Ver mais</>
            )}
          </button>
        )}
      </div>
      {/* LinkedIn action bar mockup */}
      <div className="border-t border-gray-100 px-4 py-2 flex gap-4 text-xs text-gray-500">
        <span>👍 Curtir</span>
        <span>💬 Comentar</span>
        <span>🔁 Compartilhar</span>
        <span>✉️ Enviar</span>
      </div>
    </div>
  );
}

/** Preview de mensagem WhatsApp com formatação visual */
function WhatsAppPreview({ message }: { message: string }) {
  // Renderiza *negrito* e _itálico_ do WhatsApp como HTML
  const renderWhatsApp = (text: string) => {
    return text
      .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
      .replace(/_(.*?)_/g, "<em>$1</em>");
  };

  const lines = message.split("\n");
  return (
    <div className="bg-[#e5ddd5] rounded-xl p-3 min-h-32">
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 max-w-sm ml-auto">
        <div className="space-y-1">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-sm text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderWhatsApp(line) || "&nbsp;" }}
            />
          ))}
        </div>
        <p className="text-right text-xs text-gray-400 mt-2">Agora ✓✓</p>
      </div>
    </div>
  );
}

type TabKey = "post" | "image" | "briefing" | "whatsapp";
type ImageVariant = "padrao" | "autoridade" | "financeiro" | "agro";

const IMAGE_VARIANTS: { value: ImageVariant; label: string; description: string; icon: string }[] = [
  { value: "padrao",     label: "Padrão",          description: "Layout Agro Insight — Bloomberg/FT",           icon: "🏛️" },
  { value: "autoridade", label: "Alta Autoridade",  description: "Iluminação cinematográfica, contraste máximo",  icon: "🎬" },
  { value: "financeiro", label: "Mais Financeira",  description: "Candles, gráficos de linha, terminal de dados", icon: "📊" },
  { value: "agro",       label: "Mais Agro",        description: "Lavouras, pecuária e insumos em destaque",      icon: "🌾" },
];

function ContentCard({
  row,
  onRefetch,
}: {
  row: {
    id: number;
    summaryDate: Date | string;
    content: string;
    highlights: string | null;
    linkedinPost: string | null;
    whatsappText: string | null;
    imageUrl: string | null;
    approvalStatus: ApprovalStatus;
    approvedAt: Date | null;
    articleCount: number;
    generatedAt: Date;
  };
  onRefetch: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("post");
  // Inicializa com o valor salvo no banco (se existir)
  const [whatsappText, setWhatsappText] = useState<string | null>(row.whatsappText ?? null);
  const [selectedVariant, setSelectedVariant] = useState<ImageVariant>("padrao");
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const approveMutation = trpc.content.approve.useMutation({
    onSuccess: () => { toast.success("Conteúdo aprovado com sucesso!"); onRefetch(); },
    onError: (e) => toast.error("Erro ao aprovar: " + e.message),
  });

  const rejectMutation = trpc.content.reject.useMutation({
    onSuccess: () => { toast.success("Conteúdo rejeitado."); onRefetch(); },
    onError: (e) => toast.error("Erro ao rejeitar: " + e.message),
  });

  const regeneratePostMutation = trpc.content.regeneratePost.useMutation({
    onSuccess: () => { toast.success("Post LinkedIn regenerado!"); onRefetch(); },
    onError: (e) => toast.error("Erro ao regenerar post: " + e.message),
  });

  const regenerateImageMutation = trpc.content.regenerateImage.useMutation({
    onSuccess: () => { toast.success("Imagem regenerada!"); onRefetch(); },
    onError: (e) => toast.error("Erro ao regenerar imagem: " + e.message),
  });

  const handleRegenerateImage = () => {
    regenerateImageMutation.mutate({ id: row.id, variant: selectedVariant });
  };

  const generateForSummaryMutation = trpc.content.generateForSummary.useMutation({
    onSuccess: () => { toast.success("Post e imagem gerados com sucesso!"); onRefetch(); },
    onError: (e) => toast.error("Erro ao gerar conteúdo: " + e.message),
  });

  const sendBriefingEmailMutation = trpc.email.sendBriefingEmail.useMutation({
    onSuccess: () => toast.success("Briefing enviado por e-mail com sucesso!"),
    onError: (e) => toast.error("Erro ao enviar e-mail: " + e.message),
  });

  const generateWhatsAppMutation = trpc.content.generateWhatsApp.useMutation({
    onSuccess: (data) => {
      setWhatsappText(data.whatsappMessage);
      toast.success("Mensagem WhatsApp gerada!");
    },
    onError: (e) => toast.error("Erro ao gerar WhatsApp: " + e.message),
  });

  const sendFromContentMutation = trpc.whatsapp.sendFromContent.useMutation({
    onSuccess: (data) => {
      setSendResult({ sent: data.sent, failed: data.failed, skipped: data.skipped });
      setShowSendConfirm(false);
      if (data.sent > 0) {
        toast.success(`✅ Enviado para ${data.sent} assinante(s) com sucesso!`);
      } else {
        toast.warning(`Nenhuma mensagem enviada. Ignorados: ${data.skipped}`);
      }
    },
    onError: (e) => {
      setShowSendConfirm(false);
      toast.error("Erro ao enviar: " + e.message);
    },
  });

  const statusCfg = STATUS_CONFIG[row.approvalStatus] ?? STATUS_CONFIG.draft;
  // Extract YYYY-MM-DD from ISO string to avoid UTC offset shift when displaying date
  const rawIso = row.summaryDate instanceof Date
    ? row.summaryDate.toISOString()
    : new Date(row.summaryDate as string).toISOString();
  const [ry, rm, rd] = rawIso.split('T')[0].split('-');
  const dateLabel = `${rd}/${rm}/${ry}`;

  const hasContent = row.linkedinPost || row.imageUrl;
  const isLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    regeneratePostMutation.isPending ||
    regenerateImageMutation.isPending ||
    generateForSummaryMutation.isPending ||
    generateWhatsAppMutation.isPending ||
    sendBriefingEmailMutation.isPending;

  const copyPost = () => {
    if (row.linkedinPost) {
      navigator.clipboard.writeText(row.linkedinPost);
      toast.success("Post copiado para a área de transferência!");
    }
  };

  const copyBriefing = () => {
    if (row.content) {
      navigator.clipboard.writeText(row.content);
      toast.success("Briefing copiado para a área de transferência!");
    }
  };

  const copyWhatsApp = () => {
    const text = whatsappText;
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success("Mensagem WhatsApp copiada!");
    }
  };

  const TABS: { key: TabKey; icon: React.ElementType; label: string }[] = [
    { key: "post", icon: Linkedin, label: "Post LinkedIn" },
    { key: "image", icon: ImageIcon, label: "Imagem" },
    { key: "briefing", icon: FileText, label: "Briefing" },
    { key: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
  ];

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Briefing de {dateLabel}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.articleCount} artigos analisados · Gerado em{" "}
              {new Date(row.generatedAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={statusCfg.variant}
              className={
                row.approvalStatus === "approved"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : row.approvalStatus === "pending_approval"
                  ? "bg-amber-100 text-amber-700 border-amber-200"
                  : row.approvalStatus === "rejected"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-gray-100 text-gray-600 border-gray-200"
              }
            >
              {statusCfg.label}
            </Badge>
            {row.approvedAt && (
              <span className="text-xs text-muted-foreground">
                em {new Date(row.approvedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? tab.key === "whatsapp"
                    ? "border-green-500 text-green-600"
                    : "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.key === "whatsapp" && row.whatsappText && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Mensagem salva" />
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tab: Post LinkedIn */}
        {activeTab === "post" && (
          <div className="space-y-3">
            {row.linkedinPost ? (
              <>
                <LinkedInPostPreview post={row.linkedinPost} />
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={copyPost} className="gap-1.5 text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copiar Post
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => regeneratePostMutation.mutate({ id: row.id })}
                    disabled={isLoading}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratePostMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerar Post
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3 text-muted-foreground">
                <AlertCircle className="w-8 h-8 opacity-40" />
                <p className="text-sm">Post LinkedIn ainda não foi gerado para este briefing.</p>
                <Button size="sm" onClick={() => generateForSummaryMutation.mutate({ id: row.id })} disabled={isLoading} className="gap-1.5">
                  <Sparkles className={`w-4 h-4 ${generateForSummaryMutation.isPending ? "animate-spin" : ""}`} />
                  {generateForSummaryMutation.isPending ? "Gerando..." : "Gerar Post + Imagem"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Imagem */}
        {activeTab === "image" && (
          <div className="space-y-4">
            {/* Seletor de variação */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estilo Visual</p>
              <div className="grid grid-cols-2 gap-2">
                {IMAGE_VARIANTS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setSelectedVariant(v.value)}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                      selectedVariant === v.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5">{v.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold leading-tight ${
                        selectedVariant === v.value ? "text-primary" : "text-foreground"
                      }`}>{v.label}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">{v.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {row.imageUrl ? (
              <>
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={row.imageUrl} alt="Imagem institucional gerada" className="w-full object-cover" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => window.open(row.imageUrl!, "_blank")} className="gap-1.5 text-xs">
                    <ImageIcon className="w-3.5 h-3.5" /> Abrir em tamanho real
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(row.imageUrl!);
                      toast.success("URL da imagem copiada!");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar URL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={async () => {
                      try {
                        const response = await fetch(row.imageUrl!);
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `agro-insight-${row.summaryDate instanceof Date ? row.summaryDate.toISOString().slice(0, 10) : String(row.summaryDate).slice(0, 10)}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success("Download iniciado!");
                      } catch {
                        toast.error("Erro ao baixar a imagem. Tente abrir em tamanho real e salvar manualmente.");
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar Imagem
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateImage}
                    disabled={isLoading}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerateImageMutation.isPending ? "animate-spin" : ""}`} />
                    {regenerateImageMutation.isPending
                      ? "Gerando..."
                      : `Regenerar — ${IMAGE_VARIANTS.find((v) => v.value === selectedVariant)?.label}`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3 text-muted-foreground">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm">Imagem ainda não foi gerada para este briefing.</p>
                <Button size="sm" onClick={() => generateForSummaryMutation.mutate({ id: row.id })} disabled={isLoading} className="gap-1.5">
                  <Sparkles className={`w-4 h-4 ${generateForSummaryMutation.isPending ? "animate-spin" : ""}`} />
                  {generateForSummaryMutation.isPending ? "Gerando..." : "Gerar Post + Imagem"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Briefing */}
        {activeTab === "briefing" && (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-lg p-4 max-h-80 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-sans leading-relaxed text-justify hyphens-auto">
                {row.content}
              </pre>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={copyBriefing} className="gap-1.5 text-xs">
                <Copy className="w-3.5 h-3.5" /> Copiar Briefing
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendBriefingEmailMutation.mutate({ id: row.id })}
                disabled={isLoading}
                className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Mail className={`w-3.5 h-3.5 ${sendBriefingEmailMutation.isPending ? "animate-pulse" : ""}`} />
                {sendBriefingEmailMutation.isPending ? "Enviando..." : "Enviar por E-mail"}
              </Button>
            </div>
          </div>
        )}

        {/* Tab: WhatsApp */}
        {activeTab === "whatsapp" && (
          <div className="space-y-3">
            {whatsappText ? (
              <>
                <WhatsAppPreview message={whatsappText} />

                {/* Botões de ação */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={copyWhatsApp}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateWhatsAppMutation.mutate({ id: row.id })}
                    disabled={isLoading}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generateWhatsAppMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerar
                  </Button>
                  {!showSendConfirm && (
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white ml-auto"
                      onClick={() => { setSendResult(null); setShowSendConfirm(true); }}
                      disabled={isLoading}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Enviar para Assinantes
                    </Button>
                  )}
                </div>

                {/* Confirmação de envio */}
                {showSendConfirm && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-2">
                    <p className="text-sm font-semibold text-amber-900">⚠️ Confirmar envio para todos os assinantes?</p>
                    <p className="text-xs text-amber-800">O texto acima será enviado imediatamente via WhatsApp para todos os assinantes ativos. Esta ação não pode ser desfeita.</p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                        onClick={() => sendFromContentMutation.mutate({ summaryId: row.id })}
                        disabled={sendFromContentMutation.isPending}
                      >
                        {sendFromContentMutation.isPending ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                        ) : (
                          <><MessageCircle className="w-3.5 h-3.5" /> Confirmar Envio</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => setShowSendConfirm(false)}
                        disabled={sendFromContentMutation.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Resultado do envio */}
                {sendResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-800">✅ Envio concluído</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Enviados: <strong>{sendResult.sent}</strong> &nbsp;·&nbsp;
                      Falhas: <strong>{sendResult.failed}</strong> &nbsp;·&nbsp;
                      Ignorados: <strong>{sendResult.skipped}</strong>
                    </p>
                  </div>
                )}

                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
                  <strong>Dica:</strong> Copie o texto e cole diretamente no WhatsApp. A formatação <strong>*negrito*</strong> e <em>_itálico_</em> será aplicada automaticamente pelo app.
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3 text-muted-foreground">
                <MessageCircle className="w-8 h-8 opacity-40" />
                <div>
                  <p className="text-sm font-medium text-foreground">Gerar versão WhatsApp</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    A IA cria uma versão otimizada para leitura no celular, com emojis temáticos e formatação WhatsApp (*negrito*, _itálico_).
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => generateWhatsAppMutation.mutate({ id: row.id })}
                  disabled={isLoading}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className={`w-4 h-4 ${generateWhatsAppMutation.isPending ? "animate-spin" : ""}`} />
                  {generateWhatsAppMutation.isPending ? "Gerando..." : "Gerar Mensagem WhatsApp"}
                </Button>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Ações de aprovação */}
        {row.approvalStatus !== "approved" && hasContent && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">Decisão:</span>
            <Button
              size="sm"
              onClick={() => approveMutation.mutate({ id: row.id })}
              disabled={isLoading}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {approveMutation.isPending ? "Aprovando..." : "Aprovar Conteúdo"}
            </Button>
            {row.approvalStatus !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectMutation.mutate({ id: row.id })}
                disabled={isLoading}
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 text-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                Rejeitar
              </Button>
            )}
          </div>
        )}
        {row.approvalStatus === "approved" && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Conteúdo aprovado</span>
            {row.approvedAt && (
              <span className="text-xs text-muted-foreground">
                em {new Date(row.approvedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContentApproval() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data: result, isLoading, refetch } = trpc.content.getLatest.useQuery({ page, pageSize });
  const rows = result?.rows ?? [];
  const totalPages = result?.totalPages ?? 1;
  const total = result?.total ?? 0;

  const pendingCount = rows?.filter((r) => r.approvalStatus === "pending_approval").length ?? 0;
  const approvedCount = rows?.filter((r) => r.approvalStatus === "approved").length ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Esteira de Conteúdo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revise, ajuste e aprove os posts e imagens gerados pela IA antes de publicar.
          </p>
        </div>
        <div className="flex gap-3">
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
              <Clock className="w-3 h-3" />
              {pendingCount} aguardando
            </Badge>
          )}
          {approvedCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
              <CheckCircle className="w-3 h-3" />
              {approvedCount} aprovados
            </Badge>
          )}
        </div>
      </div>

      {/* Instruções */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground/80">
        <p className="font-medium text-foreground mb-1">Como funciona a Fase 1</p>
        <p>
          Após cada geração de resumo diário, a IA cria automaticamente um{" "}
          <strong>post LinkedIn</strong> no seu tom de autoridade e uma{" "}
          <strong>imagem institucional</strong> com os destaques do dia. Use a aba{" "}
          <strong>WhatsApp</strong> para gerar uma versão otimizada para celular. Revise, regenere se necessário e aprove antes de publicar.
        </p>
      </div>

      {/* Lista de conteúdos */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 text-muted-foreground">
          <Sparkles className="w-12 h-12 opacity-30" />
          <div>
            <p className="font-medium text-foreground">Nenhum conteúdo gerado ainda</p>
            <p className="text-sm mt-1">
              O sistema gera automaticamente posts e imagens após cada resumo diário às 06:00 BRT.
              <br />
              Você também pode acionar manualmente em{" "}
              <strong>Resumo IA → Gerar Resumo Diário</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row) => (
            <ContentCard
              key={row.id}
              row={{
                ...row,
                approvalStatus: (row.approvalStatus ?? "draft") as ApprovalStatus,
                whatsappText: row.whatsappText ?? null,
              }}
              onRefetch={refetch}
            />
          ))}
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Exibindo {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total} briefings
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Anterior
                </Button>
                <span className="text-sm font-medium px-2">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
