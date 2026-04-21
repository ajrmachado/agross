import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Smartphone, Mail, MessageCircle, CreditCard, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MyProfile() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName((user as any).name ?? "");
      setPhone((user as any).phone ?? "");
      setWhatsappOptIn((user as any).whatsappOptIn ?? true);
    }
  }, [user]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      setSaved(true);
      utils.auth.me.invalidate();
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe o WhatsApp com DDD e código do país (ex: 5561999999999)");
      return;
    }
    updateProfile.mutate({
      name: name.trim(),
      phone: digits,
      whatsappOptIn,
    });
  }

  const subscriptionStatus = (user as any)?.subscriptionStatus;
  const subscriptionPlan = (user as any)?.subscriptionPlan;
  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-green-600" />
          Meu Perfil
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas informações e preferências de notificação
        </p>
      </div>

      {/* Subscription status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isActive ? (
              <>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" /> Ativa
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">
                  Plano: <strong>{subscriptionPlan ?? "—"}</strong>
                </span>
                {subscriptionStatus === "trialing" && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                    Período de teste
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-gray-500">Sem assinatura ativa</Badge>
                <a href="/pricing" className="text-sm text-green-600 hover:underline">
                  Ver planos →
                </a>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
          <CardDescription>
            Seu nome e telefone são usados para personalizar o Morning Call no WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome completo
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                E-mail
              </Label>
              <Input
                value={(user as any)?.email ?? ""}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Gerenciado pelo login OAuth</p>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                WhatsApp (com código do país)
              </Label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="5561999999999"
                maxLength={20}
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Formato: 55 (Brasil) + DDD + número. Ex: <strong>5561999999999</strong>
              </p>
            </div>

            {/* WhatsApp opt-in */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Receber Morning Call via WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Briefing diário às 06:00 BRT com link para o painel
                  </p>
                </div>
              </div>
              <Switch
                checked={whatsappOptIn}
                onCheckedChange={setWhatsappOptIn}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : saved ? (
                <><CheckCircle className="h-4 w-4 mr-2" />Salvo!</>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
