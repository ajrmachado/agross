import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Newspaper,
  Sparkles,
  Rss,
  Activity,
  TrendingUp,
  CreditCard,
  CheckCircle,
  ArrowLeftRight,
  ShieldCheck,
  MessageCircle,
  UserCircle,
  BarChart2,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { OnboardingModal } from "./OnboardingModal";
import { trpc } from "@/lib/trpc";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { toast } from "sonner";

// ─── Menu items ───────────────────────────────────────────────────────────────
// requiresSubscription: true → non-subscribers see a lock icon and are redirected to /pricing
// adminOnly: true → only admin users see this item
// publisherOrAdmin: true → visible to agro_publisher plan users AND admins
// Artigos is last (after Meu Perfil) as requested

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard",           path: "/",               adminOnly: false, publisherOrAdmin: false, requiresSubscription: false },
  { icon: Sparkles,        label: "Resumo IA",           path: "/summary",        adminOnly: false, publisherOrAdmin: false, requiresSubscription: true  },
  { icon: TrendingUp,      label: "Cotações",            path: "/commodities",    adminOnly: false, publisherOrAdmin: false, requiresSubscription: true  },
  { icon: ArrowLeftRight,  label: "Conversão",           path: "/conversao",      adminOnly: false, publisherOrAdmin: false, requiresSubscription: true  },
  { icon: CheckCircle,     label: "Esteira de Conteúdo", path: "/aprovacao",      adminOnly: false, publisherOrAdmin: true,  requiresSubscription: false },
  { icon: Rss,             label: "Feeds RSS",           path: "/feeds",          adminOnly: true,  publisherOrAdmin: false, requiresSubscription: false },
  { icon: Activity,        label: "Status do Sistema",   path: "/jobs",           adminOnly: true,  publisherOrAdmin: false, requiresSubscription: false },
  { icon: MessageCircle,   label: "WhatsApp",            path: "/whatsapp-admin", adminOnly: true,  publisherOrAdmin: false, requiresSubscription: false },
  { icon: BarChart2,       label: "Painel Comercial",    path: "/admin/comercial",adminOnly: true,  publisherOrAdmin: false, requiresSubscription: false },
  { icon: CreditCard,      label: "Planos",              path: "/pricing",        adminOnly: false, publisherOrAdmin: false, requiresSubscription: false },
  { icon: UserCircle,      label: "Meu Perfil",          path: "/perfil",         adminOnly: false, publisherOrAdmin: false, requiresSubscription: false },
  { icon: Newspaper,       label: "Artigos",             path: "/articles",       adminOnly: false, publisherOrAdmin: false, requiresSubscription: true  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
  allowPublic = false,
}: {
  children: React.ReactNode;
  /** When true, non-authenticated users see the children directly (no login wall) */
  allowPublic?: boolean;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const utils = trpc.useUtils();

  // Onboarding: show modal if user is logged in but hasn't completed profile
  const needsOnboarding = !loading && !!user && !(user as any).profileCompleted;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    // If allowPublic, render children without sidebar (public page)
    if (allowPublic) {
      return <>{children}</>;
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Onboarding modal — blocks interaction until profile is complete */}
      <OnboardingModal
        open={needsOnboarding}
        userName={user?.name}
        userEmail={(user as any)?.email}
        onComplete={() => utils.auth.me.invalidate()}
      />

      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

const ADMIN_PATHS = ["/feeds", "/jobs", "/whatsapp-admin", "/admin/comercial"];
const PUBLISHER_OR_ADMIN_PATHS = ["/aprovacao"];

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin";
  const userPlan = (user as any)?.subscriptionPlan as string | undefined;
  const isPublisher = isAdmin || userPlan === "agro_publisher";

  // Check if user has an active subscription
  const isSubscriber =
    isAdmin ||
    (user as any)?.subscriptionStatus === "active" ||
    (user as any)?.subscriptionStatus === "trialing";

  // Trial banner: show days remaining for trialing users
  const trialEndsAt = (user as any)?.trialEndsAt ? new Date((user as any).trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const showTrialBanner =
    !isAdmin &&
    (user as any)?.subscriptionStatus === "trialing" &&
    trialDaysLeft !== null &&
    trialDaysLeft <= 3;

  // Build visible menu items based on role and plan
  const visibleMenuItems = menuItems.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.publisherOrAdmin) return isPublisher;
    return true;
  });
  const activeMenuItem = visibleMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  // Track page views for commercial dashboard analytics
  useTrackPageView();

  // Protect routes by role/plan: redirect unauthorized users to dashboard
  useEffect(() => {
    if (ADMIN_PATHS.includes(location) && !isAdmin) {
      setLocation("/");
    }
    if (PUBLISHER_OR_ADMIN_PATHS.includes(location) && !isPublisher) {
      setLocation("/");
    }
  }, [isAdmin, isPublisher, location, setLocation]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Handle menu item click with subscription check
  function handleMenuClick(item: typeof menuItems[0]) {
    if (item.requiresSubscription && !isSubscriber) {
      toast("Conteúdo exclusivo para assinantes", {
        description: "Assine o AgroRSS para acessar este recurso.",
        action: {
          label: "Ver planos",
          onClick: () => setLocation("/pricing"),
        },
        duration: 4000,
      });
      setLocation("/pricing");
      return;
    }
    setLocation(item.path);
  }

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shrink-0">
                    <Rss className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-bold tracking-tight truncate text-sidebar-foreground text-sm">
                      AgroRSS
                    </span>
                    <span className="block text-xs text-sidebar-foreground/60 truncate">
                      Painel do Agronegócio
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                const isLocked = item.requiresSubscription && !isSubscriber;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleMenuClick(item)}
                      tooltip={isLocked ? `${item.label} — Exclusivo para assinantes` : item.label}
                      className={`h-10 transition-all font-normal ${isLocked ? "opacity-60" : ""}`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {isLocked && !isCollapsed && (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      {isAdmin && (
                        <Badge className="h-4 px-1.5 text-[10px] font-semibold bg-primary/15 text-primary border-primary/20 shrink-0">
                          <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Trial expiry warning banner */}
        {showTrialBanner && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {trialDaysLeft === 0
                ? "Seu período de teste termina hoje."
                : `Seu período de teste termina em ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"}.`}
              {" "}Assine agora para manter o acesso.
            </p>
            <button
              onClick={() => setLocation("/pricing")}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2 whitespace-nowrap hover:opacity-80"
            >
              Ver planos
            </button>
          </div>
        )}

        {/* Trial expired banner */}
        {!isAdmin && (user as any)?.subscriptionStatus === "expired" && (
          <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive font-medium">
              Seu período de teste expirou. Assine um plano para continuar acessando o AgroRSS.
            </p>
            <button
              onClick={() => setLocation("/pricing")}
              className="text-xs font-semibold text-destructive underline underline-offset-2 whitespace-nowrap hover:opacity-80"
            >
              Assinar agora
            </button>
          </div>
        )}

        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
