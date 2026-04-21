import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Smartphone, User, Mail, MessageCircle } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  userName?: string | null;
  userEmail?: string | null;
  onComplete: () => void;
}

export function OnboardingModal({ open, userName, userEmail, onComplete }: OnboardingModalProps) {
  const [name, setName] = useState(userName ?? "");
  const [phone, setPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Perfil salvo! Bem-vindo ao AgroRSS 🌱");
      onComplete();
    },
    onError: (err) => {
      toast.error("Erro ao salvar perfil: " + err.message);
    },
  });

  function formatPhone(value: string) {
    // Keep only digits
    return value.replace(/\D/g, "");
  }

  function validate() {
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Nome deve ter pelo menos 2 caracteres";
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 20) {
      errs.phone = "Informe o WhatsApp com DDD e código do país (ex: 5561999999999)";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    updateProfile.mutate({
      name: name.trim(),
      phone: phone.replace(/\D/g, ""),
      whatsappOptIn,
    });
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent closing by clicking outside or pressing Escape
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Complete seu cadastro</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Precisamos de algumas informações para personalizar seu Morning Call
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="onb-name" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Nome completo
            </Label>
            <Input
              id="onb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className={errors.name ? "border-red-400" : ""}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Email (read-only, from OAuth) */}
          {userEmail && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                E-mail
              </Label>
              <Input value={userEmail} disabled className="bg-muted text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Confirmado via login</p>
            </div>
          )}

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="onb-phone" className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              WhatsApp (com código do país)
            </Label>
            <Input
              id="onb-phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="5561999999999"
              maxLength={20}
              inputMode="numeric"
              className={errors.phone ? "border-red-400" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Formato: 55 (Brasil) + DDD + número. Ex: <strong>5561999999999</strong>
            </p>
            {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
          </div>

          {/* WhatsApp opt-in */}
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <Checkbox
              id="onb-whatsapp"
              checked={whatsappOptIn}
              onCheckedChange={(v) => setWhatsappOptIn(!!v)}
              className="mt-0.5"
            />
            <div>
              <label htmlFor="onb-whatsapp" className="text-sm font-medium text-green-900 cursor-pointer">
                Receber Morning Call diário via WhatsApp
              </label>
              <p className="text-xs text-green-700 mt-0.5">
                Às 06:00 BRT, você receberá o briefing do agronegócio com link para o painel completo.
                Você pode cancelar a qualquer momento em "Meu Perfil".
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
            ) : (
              "Acessar o painel →"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
