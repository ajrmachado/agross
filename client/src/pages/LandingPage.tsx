import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import {
  Zap,
  BarChart3,
  FileText,
  Rss,
  ArrowRight,
  Check,
  Star,
  TrendingUp,
  Clock,
  Shield,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Clock className="w-5 h-5" />,
    title: "Briefing às 7h todo dia",
    desc: "IA analisa todas as fontes e entrega um resumo executivo pronto antes de você começar o dia.",
  },
  {
    icon: <Rss className="w-5 h-5" />,
    title: "Fontes do agro em um lugar",
    desc: "Canal Rural, CEPEA, USDA, Notícias Agrícolas e dezenas de outras fontes agregadas automaticamente.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Cotações em tempo real",
    desc: "Soja, Milho, Boi Gordo, Café, Algodão — futuros CBOT/CME atualizados a cada 30 minutos.",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Resumos por período",
    desc: "Gere briefings diários, semanais, mensais ou por qualquer intervalo de datas com um clique.",
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: "Análise por categoria",
    desc: "Mercado, commodities, clima, política agrícola, tecnologia e internacional — tudo categorizado.",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Seguro e confiável",
    desc: "Dados processados com IA de última geração. Pagamento seguro via Stripe. Cancele quando quiser.",
  },
];

const TESTIMONIALS = [
  {
    name: "Rodrigo Mendes",
    role: "Gerente de Crédito Agro — Banco Regional",
    text: "Antes eu passava 40 minutos por dia lendo sites diferentes. Agora abro o AgroRSS às 7h e já tenho tudo que preciso para as reuniões do dia.",
    rating: 5,
  },
  {
    name: "Ana Paula Ferreira",
    role: "Consultora de Originação — Trading de Grãos",
    text: "O resumo semanal virou meu relatório de acompanhamento para os clientes. Economizo horas toda semana.",
    rating: 5,
  },
  {
    name: "Carlos Eduardo Lima",
    role: "Diretor Comercial — Cooperativa Centro-Oeste",
    text: "Finalmente um produto pensado para quem trabalha com agro financeiro. As cotações e o briefing diário são indispensáveis.",
    rating: 5,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-lg">AgroRSS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Planos
              </Button>
            </Link>
            <Link href={getLoginUrl()}>
              <Button variant="outline" size="sm">Entrar</Button>
            </Link>
            <Link href="/pricing">
              <Button size="sm">
                Começar grátis
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 text-primary border-primary/30 bg-primary/5 text-sm px-4 py-1.5">
              <Star className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Morning Call do Agronegócio
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
              Inteligência do agro,{" "}
              <span className="text-primary">pronta para usar</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl">
              Todo dia às 7h, um briefing executivo com os principais destaques do agronegócio gerado por IA — cotações, notícias, análises e tendências em um único painel.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/pricing">
                <Button size="lg" className="text-base px-8 py-6">
                  Começar 7 dias grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href={getLoginUrl()}>
                <Button variant="outline" size="lg" className="text-base px-8 py-6">
                  Já tenho conta
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Sem cartão obrigatório no trial · Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-border/50 bg-muted/20 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Briefing diário automático às 07h
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              +20 fontes do agronegócio agregadas
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Cotações CBOT/CME em tempo real
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Resumos por IA (diário, semanal, mensal)
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa para decidir melhor
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desenvolvido por profissionais do agronegócio financeiro para quem precisa de informação qualificada, rápida e confiável.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/20 border-y border-border/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Quem usa, recomenda
            </h2>
            <p className="text-muted-foreground">
              Profissionais do agronegócio que transformaram sua rotina de informação.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4 italic">
                  "{t.text}"
                </p>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simples e transparente
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-xl mx-auto">
            Dois planos. Sem surpresas. 7 dias grátis para experimentar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
            {[
              {
                name: "Morning Call Agro",
                price: "R$ 97",
                desc: "Dashboard, artigos, cotações e todos os resumos IA",
                highlight: false,
              },
              {
                name: "Corporativo",
                price: "R$ 197",
                desc: "Tudo do Morning Call + Esteira de Conteúdo completa",
                highlight: true,
              },
            ].map((p, i) => (
              <div
                key={i}
                className={`p-6 rounded-2xl border text-left ${
                  p.highlight
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                {p.highlight && (
                  <Badge className="mb-3 bg-primary text-primary-foreground text-xs">
                    Mais completo
                  </Badge>
                )}
                <p className="font-bold text-foreground text-lg">{p.name}</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {p.price}<span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">{p.desc}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing">
            <Button size="lg" className="text-base px-10 py-6">
              Ver planos completos
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Comece hoje. 7 dias grátis.
          </h2>
          <p className="text-lg opacity-80 mb-10 max-w-xl mx-auto">
            Junte-se a profissionais do agronegócio que já tomam decisões mais rápidas e estratégicas com o AgroRSS.
          </p>
          <Link href="/pricing">
            <Button
              size="lg"
              variant="outline"
              className="text-base px-10 py-6 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Começar agora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">AgroRSS</span>
            <span>— Inteligência do agronegócio</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Planos</Link>
            <Link href={getLoginUrl()} className="hover:text-foreground transition-colors">Entrar</Link>
          </div>
          <p>© {new Date().getFullYear()} AgroRSS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
