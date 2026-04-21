import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  Users, Building2, TrendingUp, TrendingDown, DollarSign,
  Activity, Clock, Star, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const iso = d instanceof Date ? d.toISOString() : new Date(d).toISOString();
  const [y, m, day] = iso.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function planLabel(plan: string | null | undefined) {
  if (!plan) return "Sem plano";
  if (plan === "morning_call") return "Morning Call";
  if (plan === "corporativo") return "Corporativo";
  return plan;
}

function statusBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="outline" className="text-gray-400">Sem assinatura</Badge>;
  if (status === "active") return <Badge className="bg-emerald-600 text-white">Ativo</Badge>;
  if (status === "trialing") return <Badge className="bg-blue-600 text-white">Trial</Badge>;
  if (status === "canceled") return <Badge variant="destructive">Cancelado</Badge>;
  if (status === "past_due") return <Badge className="bg-amber-600 text-white">Em atraso</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, subtitle, icon: Icon, color = "emerald",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
}) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-900/30",
    blue: "text-blue-400 bg-blue-900/30",
    amber: "text-amber-400 bg-amber-900/30",
    red: "text-red-400 bg-red-900/30",
    purple: "text-purple-400 bg-purple-900/30",
  };
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon className={`w-5 h-5 ${colorMap[color].split(" ")[0]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CommercialDashboard() {
  const { user } = useAuth();
  const [mrrMonths] = useState(6);

  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = trpc.commercial.overview.useQuery();
  const { data: subGroups } = trpc.commercial.subscriptionGroups.useQuery();
  const { data: users } = trpc.commercial.users.useQuery({ limit: 200 });
  const { data: orgs } = trpc.commercial.organizations.useQuery();
  const { data: mrrHistory } = trpc.commercial.mrrHistory.useQuery({ months: mrrMonths });
  const { data: hourlyUsage } = trpc.commercial.hourlyUsage.useQuery({ days: 7 });
  const { data: topFeatures } = trpc.commercial.topFeatures.useQuery({ days: 30 });
  const { data: topPages } = trpc.commercial.topPages.useQuery({ days: 30 });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <AlertTriangle className="w-10 h-10 mb-3 text-amber-500" />
        <p className="text-lg font-medium">Acesso restrito ao administrador</p>
        <Link href="/" className="mt-4 text-emerald-400 hover:underline text-sm">← Voltar ao painel</Link>
      </div>
    );
  }

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="ml-3 text-gray-400">Carregando métricas comerciais...</span>
      </div>
    );
  }

  const mrrChartData = (mrrHistory ?? []).map((d) => ({
    month: d.month,
    MRR: d.mrr,
    Usuários: d.userCount,
  }));

  const hourlyData = (hourlyUsage ?? []).map((h) => ({
    hora: `${String(h.hour).padStart(2, "0")}h`,
    acessos: h.count,
  }));

  const subGroupData = (subGroups ?? []).map((g) => ({
    name: `${planLabel(g.plan)} (${g.status})`,
    count: g.count,
    mrr: g.mrr,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Painel Comercial
          </h1>
          <p className="text-sm text-gray-400 mt-1">Acesso restrito — Administrador</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchOverview()}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="MRR"
          value={formatBRL(overview?.mrr ?? 0)}
          subtitle="Receita mensal recorrente"
          icon={DollarSign}
          color="emerald"
        />
        <KpiCard
          title="ARR Estimado"
          value={formatBRL(overview?.arrEstimated ?? 0)}
          subtitle="MRR × 12"
          icon={TrendingUp}
          color="blue"
        />
        <KpiCard
          title="Total de Usuários"
          value={String(overview?.totalUsers ?? 0)}
          subtitle={`+${overview?.newUsersLast7Days ?? 0} nos últimos 7 dias`}
          icon={Users}
          color="purple"
        />
        <KpiCard
          title="Organizações"
          value={String(overview?.totalOrgs ?? 0)}
          subtitle="Plano Corporativo ativo"
          icon={Building2}
          color="amber"
        />
      </div>

      {/* Subscription Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs text-gray-400">Assinaturas ativas</p>
                <p className="text-xl font-bold text-white">{overview?.activeSubscriptions ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-xs text-gray-400">Em trial</p>
                <p className="text-xl font-bold text-white">{overview?.trialSubscriptions ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-xs text-gray-400">Canceladas</p>
                <p className="text-xl font-bold text-white">{overview?.canceledSubscriptions ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs text-gray-400">Em atraso</p>
                <p className="text-xl font-bold text-white">{overview?.pastDueSubscriptions ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Evolution */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Evolução do MRR (últimos {mrrMonths} meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mrrChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mrrChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#f9fafb" }}
                    formatter={(v: number) => [formatBRL(v), "MRR"]}
                  />
                  <Area type="monotone" dataKey="MRR" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                Dados insuficientes para gráfico
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hourly Usage */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Horários de acesso (últimos 7 dias, BRT)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyData.some((h) => h.acessos > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hora" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#f9fafb" }}
                  />
                  <Bar dataKey="acessos" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                Sem dados de acesso ainda — os eventos serão registrados conforme os usuários navegam
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Groups + Top Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Groups */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Grupos por assinatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subGroupData.length > 0 ? (
              <div className="space-y-3">
                {subGroupData.map((g) => (
                  <div key={g.name} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm text-white font-medium">{g.name}</p>
                      <p className="text-xs text-gray-400">{g.count} usuário{g.count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-emerald-400 font-medium">{formatBRL(g.mrr)}</p>
                      <p className="text-xs text-gray-500">MRR</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">Nenhuma assinatura registrada</p>
            )}
          </CardContent>
        </Card>

        {/* Top Features / Pages */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Funcionalidades mais usadas (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(topFeatures ?? []).length > 0 ? (
              <div className="space-y-2">
                {topFeatures!.map((f, i) => (
                  <div key={f.feature} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-white">{f.feature}</span>
                        <span className="text-xs text-gray-400">{f.count}×</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, (f.count / (topFeatures![0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-gray-500 text-sm">Sem dados de uso ainda</p>
                <p className="text-gray-600 text-xs mt-1">Os eventos serão registrados conforme os usuários interagem com o sistema</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Users & Orgs Tables */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="users" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Usuários ({users?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="orgs" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            <Building2 className="w-4 h-4 mr-2" />
            Organizações ({orgs?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pages" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-2" />
            Páginas visitadas
          </TabsTrigger>
        </TabsList>

        {/* Users Table */}
        <TabsContent value="users">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400">Nome</TableHead>
                      <TableHead className="text-gray-400">E-mail</TableHead>
                      <TableHead className="text-gray-400">Telefone</TableHead>
                      <TableHead className="text-gray-400">Plano</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">WhatsApp</TableHead>
                      <TableHead className="text-gray-400">Cadastro</TableHead>
                      <TableHead className="text-gray-400">Último acesso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      (users ?? []).map((u) => (
                        <TableRow key={u.id} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="text-white font-medium">{u.name ?? "—"}</TableCell>
                          <TableCell className="text-gray-300 text-sm">{u.email ?? "—"}</TableCell>
                          <TableCell className="text-gray-400 text-sm">{u.phone ?? "—"}</TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-300">{planLabel(u.plan)}</span>
                          </TableCell>
                          <TableCell>{statusBadge(u.status)}</TableCell>
                          <TableCell>
                            {u.whatsappOptIn ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-600" />
                            )}
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm">{formatDate(u.createdAt)}</TableCell>
                          <TableCell className="text-gray-400 text-sm">{formatDate(u.lastSignedIn)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Table */}
        <TabsContent value="orgs">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              {(orgs ?? []).length === 0 ? (
                <div className="py-12 text-center">
                  <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">Nenhuma organização cadastrada</p>
                  <p className="text-gray-600 text-sm mt-1">Organizações são criadas quando um cliente assina o plano Corporativo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-transparent">
                        <TableHead className="text-gray-400">Organização</TableHead>
                        <TableHead className="text-gray-400">Responsável</TableHead>
                        <TableHead className="text-gray-400">Plano</TableHead>
                        <TableHead className="text-gray-400">Membros</TableHead>
                        <TableHead className="text-gray-400">Limite</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Criada em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgs!.map((o) => (
                        <TableRow key={o.id} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="text-white font-medium">{o.name}</TableCell>
                          <TableCell className="text-gray-300 text-sm">
                            <div>{o.ownerName ?? "—"}</div>
                            <div className="text-gray-500 text-xs">{o.ownerEmail ?? ""}</div>
                          </TableCell>
                          <TableCell><span className="text-sm text-gray-300">{planLabel(o.plan)}</span></TableCell>
                          <TableCell className="text-gray-300">{o.memberCount}</TableCell>
                          <TableCell className="text-gray-400">{o.maxUsers}</TableCell>
                          <TableCell>
                            {o.active ? (
                              <Badge className="bg-emerald-600 text-white">Ativa</Badge>
                            ) : (
                              <Badge variant="destructive">Inativa</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm">{formatDate(o.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Pages */}
        <TabsContent value="pages">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-6">
              {(topPages ?? []).length > 0 ? (
                <div className="space-y-3">
                  {topPages!.map((p, i) => (
                    <div key={p.page} className="flex items-center gap-4">
                      <span className="text-xs text-gray-500 w-5 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-white font-mono">{p.page}</span>
                          <span className="text-xs text-gray-400">{p.count} visitas</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${Math.min(100, (p.count / (topPages![0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-gray-500 text-sm">Sem dados de páginas visitadas ainda</p>
                  <p className="text-gray-600 text-xs mt-1">Os dados serão registrados conforme os usuários navegam pelo sistema</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Users Alert */}
      {(overview?.newUsersLast30Days ?? 0) > 0 && (
        <Card className="bg-emerald-900/20 border-emerald-800">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-white font-medium">
                  {overview!.newUsersLast30Days} novo{overview!.newUsersLast30Days !== 1 ? "s" : ""} usuário{overview!.newUsersLast30Days !== 1 ? "s" : ""} nos últimos 30 dias
                </p>
                <p className="text-emerald-300/70 text-sm">
                  {overview!.newUsersLast7Days} nos últimos 7 dias
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
