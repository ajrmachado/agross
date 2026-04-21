# Agro RSS Dashboard - TODO

## Schema e Banco de Dados
- [x] Tabela `rss_feeds` (id, name, url, category, active, fetchErrorCount, createdAt)
- [x] Tabela `articles` (id, feedId, title, description, link, source, publishedAt, category, guid, createdAt)
- [x] Tabela `daily_summaries` (id, summaryDate, content, highlights, articleCount, generatedAt)
- [x] Tabela `job_logs` (id, jobName, status, message, articlesAdded, startedAt, finishedAt)
- [x] Migração e aplicação do schema via webdev_execute_sql

## Backend
- [x] Instalar dependência rss-parser (npm)
- [x] Serviço de parsing RSS em `server/rss.ts`
- [x] Helpers de banco em `server/db.ts` para feeds, artigos e resumos
- [x] Job automático a cada 6h para buscar novos artigos (`server/jobs.ts`)
- [x] Geração de resumo diário com IA (invokeLLM) em `server/summarizer.ts`
- [x] Router tRPC: `feeds` (list, add, delete, toggleActive)
- [x] Router tRPC: `articles` (list com filtros por fonte/categoria, stats)
- [x] Router tRPC: `summaries` (latest, recent, generate manual, getByDate)
- [x] Router tRPC: `jobs` (status, runNow, logs)
- [x] Seed inicial dos feeds RSS configurados
- [x] Correção de upsert em daily_summaries (onDuplicateKeyUpdate)
- [x] Feeds verificados adicionados: Morning Ag Clips, The Agribiz, Campo & Negócios, Agência Brasil, Farm Progress

## Frontend
- [x] Design system: tema verde agro (paleta OKLCH)
- [x] DashboardLayout com sidebar de navegação e branding AgroRSS
- [x] Página: Dashboard principal com resumo do dia e artigos recentes
- [x] Página: Artigos com filtros por fonte e categoria + paginação
- [x] Página: Resumo IA com visualização do briefing executivo + histórico
- [x] Página: Configuração de feeds (adicionar/remover/ativar/desativar)
- [x] Página: Status do Sistema com logs de execução do job
- [x] Componente: ArticleCard com título, fonte, data e link
- [x] Componente: CategoryBadge colorido por categoria
- [x] Estatísticas: total artigos, hoje, fontes ativas, status do job

## Testes
- [x] Testes vitest para procedures de feeds, artigos, resumos e jobs (16 testes)
- [x] Teste de logout existente (1 teste)

## Entrega
- [x] Checkpoint final
- [x] Publicação e entrega ao usuário

## Cotações de Commodities (Yahoo Finance)

- [x] Validar API Yahoo Finance para soja (ZS=F), milho (ZC=F) e trigo (ZW=F)
- [x] Tabela `commodity_prices` para histórico de cotações
- [x] Serviço commodities.ts com Yahoo Finance via Data API + retry com backoff
- [x] Procedures tRPC: quotes, refresh, history, storedHistory, list
- [x] Job automático de cotações a cada 30 minutos
- [x] Widget de cotações no Dashboard (Soja, Milho, Trigo) com preço e variação
- [x] Página dedicada /commodities com gráfico histórico (Recharts) e tabela de referência
- [x] Adicionar "Cotações" na navegação lateral
- [x] Testes vitest para todas as procedures de commodities (5 novos testes)

## Paywall e Integração Stripe

- [x] Adicionar feature stripe ao projeto via webdev_add_feature
- [x] Criar produtos e preços no Stripe (Essencial R$97, Estratégico R$297, Corporativo R$1490)
- [x] Tabela `subscriptions` no banco de dados (userId, stripeCustomerId, plan, status, periodEnd)
- [x] Webhook Stripe para processar eventos de assinatura (created, updated, deleted)
- [x] Procedure tRPC: createCheckoutSession, createPortalSession, getSubscription
- [x] Página de planos (/pricing) com cards dos 3 planos e botão de assinar
- [x] Página de sucesso após pagamento (/subscription/success)
- [x] Portal do cliente Stripe para gerenciar assinatura
- [x] Paywall no Resumo IA: bloquear conteúdo para usuários sem plano (exige Essencial+)
- [x] Paywall nas Cotações: histórico e tabela bloqueados para usuários sem plano
- [x] Componente PaywallGate reutilizável com preview desfocado e modal de upgrade
- [x] Testes vitest: 21 testes passando

## Novas Cotações: Algodão e Pecuária

- [x] Validar símbolos Yahoo Finance: algodão (CT=F), boi gordo (LE=F) e boi alimentado (GF=F)
- [x] Atualizar COMMODITIES no commodities.ts com 6 símbolos (soja, milho, trigo, algodão, boi gordo, boi alimentado)
- [x] Atualizar widget do Dashboard com 6 cards em grid 2x3
- [x] Atualizar página /commodities com cards agrupados por categoria (Grãos, Pecuária, Fibras) e gráficos por grupo
- [x] Tabela de referência com unidades corretas (USX/bu, USX/lb, USX/cwt)
- [x] Testes vitest atualizados para 6 símbolos (21 testes passando)

## Paywall e Stripe (segunda etapa - implementado junto com a primeira)

- [x] Todos os itens implementados na sequência acima

## Conversão USD/BRL e R$/saca

- [x] Buscar taxa USD/BRL via Yahoo Finance (BRL=X) em tempo real
- [x] Calcular R$/saca (60kg) para Soja, Milho e Trigo
- [x] Exibir preço BRL em card verde nos QuoteCards com câmbio informado
- [x] Coluna R$/saca na tabela de referência da página Cotações
- [x] Câmbio exibido junto ao preço (ex: Câmbio: R$ 5,80/USD)

## Envio Automático do Resumo por E-mail

- [x] Serviço emailSummary.ts com buildEmailBody (cotações + resumo IA)
- [x] Busca de assinantes ativos no banco (subscriptionStatus = 'active')
- [x] Job de verificação a cada 5 minutos, disparo às 07:00 BRT
- [x] Guard para não enviar duas vezes no mesmo dia
- [x] Procedure tRPC email.sendNow (envio manual forçado)
- [x] Procedure tRPC email.status (status do envio do dia)
- [x] Card de status do e-mail na página de Status do Sistema
- [x] Botão 'Enviar agora' para teste manual

## Resumos Semanais e Mensais

- [x] Tabela `periodic_summaries` (tipo: semanal/mensal, período, conteúdo, destaques, contagem)
- [x] Função `generateWeeklySummary` no summarizer.ts (seg-sáb, até 200 artigos)
- [x] Função `generateMonthlySummary` no summarizer.ts (mês inteiro, até 300 artigos)
- [x] Job automático: resumo semanal todo sábado às 22h
- [x] Job automático: resumo mensal no último dia do mês às 23h
- [x] Procedures tRPC: summaries.generateWeekly, summaries.generateMonthly, summaries.listPeriodic
- [x] Frontend: tabs Diário / Semanal / Mensal na aba Resumo IA
- [x] Frontend: botão "Gerar resumo semanal" e "Gerar resumo mensal"
- [x] Frontend: histórico de resumos semanais e mensais no sidebar

## Conversões Completas de Commodities

- [x] Soja: R$/saca, R$/tonelada, R$/bushel
- [x] Milho: R$/saca, R$/tonelada, R$/bushel
- [x] Trigo: R$/saca, R$/tonelada, R$/bushel
- [x] Algodão: R$/libra, R$/arroba, R$/tonelada
- [x] Boi Gordo/Alimentado: R$/arroba, R$/kg, R$/tonelada
- [x] Painel de conversão expandido na página Cotações (tabela multi-unidade)

## Café, Açúcar, Busca e Yahoo Finance

- [x] Validar símbolos KC=F (café) e SB=F (açúcar) no Yahoo Finance
- [x] Adicionar café e açúcar no COMMODITIES do commodities.ts com conversões BRL
- [x] Atualizar widget Dashboard com cards de café e açúcar
- [x] Atualizar página /commodities com cards e gráficos de café e açúcar
- [x] Implementar busca por palavra-chave nos artigos (procedure tRPC + frontend com debounce 300ms)
- [x] Adicionar feeds RSS do Yahoo Finance Commodities Agro + Google News temáticos ao sistema

## Fase 1 — Esteira de Conteúdo (Manual Assistido)

- [x] Adicionar campos linkedinPost, imageUrl, approvalStatus na tabela daily_summaries (schema + migração)
- [x] Criar tabela content_outputs para rastrear outputs de conteúdo por data (campos adicionados em daily_summaries)
- [x] Função generateLinkedInPost no contentGenerator.ts com prompt de tom de autoridade (Thiago Lucena)
- [x] Função generateContentImage no contentGenerator.ts usando generateImage com highlights do dia
- [x] Atualizar generateDailySummary para gerar post LinkedIn + imagem automaticamente
- [x] Procedure tRPC: content.getLatest, content.regeneratePost, content.regenerateImage, content.generateForSummary
- [x] Procedure tRPC: content.approve e content.reject
- [x] Página /aprovacao no frontend com visualização do post LinkedIn, imagem e briefing
- [x] Componente: preview do post LinkedIn com formatação real (avatar, nome, hashtags)
- [x] Componente: preview da imagem gerada com botão de regenerar
- [x] Botão "Aprovar", "Rejeitar" e "Regenerar" na página de aprovação
- [x] Histórico de conteúdos aprovados na página de aprovação
- [x] Adicionar "Esteira de Conteúdo" na navegação lateral (ícone CheckCircle)
- [x] Testes vitest para procedures de content (8 testes passando)

## Central de Conversão de Commodities

- [x] Criar client/src/lib/conversionEngine.ts (motor puro de cálculo bidirecional)
- [x] Criar client/src/pages/Conversion.tsx (página Central de Conversão 3 colunas)
- [x] Adicionar card USD/BRL explícito na aba Cotações
- [x] Adicionar rota /conversao no App.tsx
- [x] Adicionar item "Conversão" no menu lateral (DashboardLayout)
- [x] Memória de cálculo expansível ("Ver cálculo detalhado")
- [x] Botão "Copiar cálculo" na calculadora
- [x] Contrato B3 para boi gordo (330 arrobas) como linha de resultado
- [x] Cana-de-açúcar com campo ATR opcional
- [x] Testes vitest para conversionEngine.ts (16 testes passando)

## Melhorias na Esteira de Conteúdo

- [x] Botão "Copiar Briefing" no submenu Briefing
- [x] Novo submenu "WhatsApp" com formatação para celular (emojis + negrito WhatsApp)
- [x] Procedure tRPC content.generateWhatsApp para gerar versão WhatsApp via IA
- [x] Botão "Regenerar" para a versão WhatsApp

## Novo Prompt de Imagem — Agro Insight

- [x] Atualizar generateContentImage com novo prompt padrão (estilo Bloomberg/FT, paleta preto/azul/dourado/vermelho)
- [x] Adicionar 3 variações de prompt: Alta Autoridade, Mais Financeira, Mais Agro
- [x] Atualizar procedure regenerateImage para aceitar parâmetro de variação
- [x] Atualizar frontend com seletor de variação antes de regenerar imagem
- [x] Testes vitest para as 3 variações de prompt (6 testes novos, 51 total)

## Formatação ABNT, E-mail e Assinatura

- [x] Atualizar prompts do briefing diário, semanal e mensal: remover markdown **, parágrafos justificados, padrão ABNT
- [x] Atualizar emailSummary.ts: cotações com uma cultura por linha (tabela alinhada), sem markdown **
- [x] Adicionar procedure tRPC email.sendBriefingEmail para enviar briefing por e-mail
- [x] Adicionar botão "Enviar por E-mail" na aba Briefing da Esteira de Conteúdo
- [x] Atualizar assinatura em contentGenerator.ts: "Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito"
- [x] Atualizar assinatura no prompt de imagem: "Thiago Lucena / Análise Estratégica Agronegócio - Mercado Financeiro - Crédito"

## Melhorias — Imagem, E-mail e Prompt LinkedIn

- [x] ContentApproval.tsx: botão "Copiar URL" na aba Imagem (copia URL para clipboard)
- [x] ContentApproval.tsx: botão "Baixar Imagem" na aba Imagem (download direto via blob)
- [x] emailSummary.ts: revertido para formatação simples (uma cultura por linha, sem tabela monoespaciada)
- [x] contentGenerator.ts: prompt do post LinkedIn atualizado com estrutura exata (Gancho, Insight de Valor, Pontos de Análise, Visão do Consultor, CTA, Hashtags)
- [x] Testes vitest passando (51 testes)

## Reversão do Prompt do Briefing

- [x] summarizer.ts: reverter prompt do briefing diário para o padrão anterior (rico, bem estruturado, com seções e análise profunda)
- [x] summarizer.ts: reverter prompt do briefing semanal e mensal para o padrão anterior
- [x] summarizer.ts: manter apenas instrução de parágrafos justificados (sem restrições ABNT que pioraram a qualidade)
- [x] Frontend: aplicar text-justify nos parágrafos do briefing (Resumo IA + Esteira de Conteúdo)

## Correção Formatação do Briefing

- [x] summarizer.ts: remover instrução de linhas separadoras (─────) entre seções
- [x] summarizer.ts: restaurar emojis nos títulos das seções do briefing (📝 📊 🌍 🌦️ 💳 🎯 ⚠️)
- [x] summarizer.ts: manter parágrafos justificados e sem ** markdown

## Formatação Briefing, E-mail e Filtro de Data

- [x] summarizer.ts: emojis nos títulos e instrução explícita de NÃO usar linhas separadoras
- [x] emailSummary.ts: títulos das seções em negrito HTML (<strong>) com emoji na frente, sem linhas separadoras
- [x] emailSummary.ts: removidas todas as linhas separadoras ─────── do e-mail
- [x] Articles.tsx: adicionar seletores "De" e "Até" (date inputs) na área de filtros
- [x] server/db.ts: já tinha suporte a dateFrom e dateTo (confirmado)
- [x] server/routers.ts: já tinha suporte a dateFrom e dateTo (confirmado)
- [x] Testes vitest: 51 testes passando (filtro de data coberto pelo agro.test.ts)
- [x] emailSummary.ts: tabela HTML para cotações (cabeçalho + uma linha por cultura com cores de variação)

## Correção Limite E-mail

- [x] emailSummary.ts / routers.ts: truncar conteúdo do briefing para respeitar limite de 20.000 caracteres da API de notificação (trunca em 19.000 com nota de continuação)

## Histórico de Briefings Por Período

- [x] summarizer.ts: salvar resultado de generateCustomPeriodSummary na tabela periodic_summaries (tipo 'custom') — já implementado
- [x] routers.ts: procedure summaries.recentCustom para buscar histórico de briefings tipo 'custom'
- [x] Summary.tsx: painel lateral esquerdo na aba Por Período com lista de histórico (igual Semanal/Mensal)
- [x] Summary.tsx: clicar em item do histórico carrega o briefing salvo (sem regerar)
- [x] Testes vitest para recentCustom

## Bug Fix: Timezone e Datas

- [x] BUG FIX: datas com 1 dia de defasagem — mysql2 retorna DATE como UTC midnight (00:00Z), toLocaleDateString() em servidor UTC-4 retornava dia anterior
- [x] routers.ts: adicionado helper formatDateUTC() para extrair YYYY-MM-DD do ISO string sem offset
- [x] summarizer.ts: adicionado timeZone:'UTC' em todas as chamadas toLocaleDateString() para datas UTC
- [x] summarizer.ts: resumo diário usa timeZone:'America/Sao_Paulo' (date = new Date() no servidor)
- [x] Summary.tsx (frontend): parseDbDate() já usa 'T00:00:00' local para evitar offset UTC

## Bug Fix: Histórico Por Período (produção) e Estado do Resumo

- [x] BUG CORRIGIDO: histórico Por Período não aparecia — TabsContent desmontava o componente ao trocar de aba; corrigido com forceMount no TabsContent value="custom"
- [x] BUG CORRIGIDO: resumo gerado sumia ao trocar de sub-item — estado useState perdido ao desmontar; corrigido com forceMount (componente sempre montado, Radix controla visibilidade via hidden attribute)

## Persistência do WhatsApp no Banco

- [x] Schema: adicionada coluna whatsappText (text, nullable) na tabela daily_summaries
- [x] Migração: ALTER TABLE aplicado via mysql2 (coluna confirmada no banco)
- [x] Backend routers.ts: procedure content.generateWhatsApp salva whatsappText no banco após gerar (UPDATE daily_summaries)
- [x] Backend routers.ts: procedure content.getLatest retorna whatsappText via SELECT * (inclusão automática)
- [x] Frontend ContentApproval.tsx: estado whatsappText inicializado com row.whatsappText do banco
- [x] Frontend ContentApproval.tsx: indicador visual (ponto verde) na aba WhatsApp quando texto já está salvo
- [x] Testes vitest: 4 novos testes para generateWhatsAppMessage (55 testes passando)

## Bug Fix: Dashboard e Resumo IA

- [x] BUG CORRIGIDO: área de resumo no Dashboard cortada pela metade — removido max-h-80/overflow-y-auto, texto agora exibe completo com parágrafos justificados
- [x] BUG CORRIGIDO: conteúdo "Por Período" vazando para Diário/Semanal/Mensal — Tailwind .flex sobrescrevia o hidden attribute do Radix; corrigido com data-[state=inactive]:!hidden no TabsContent com forceMount

## Redesign Layout Resumo IA

- [x] Todas as abas (Diário, Semanal, Mensal, Por Período): histórico à esquerda, resumo no topo à direita, principais destaques abaixo do resumo

## Controle de Acesso Admin-Only

- [x] Ocultar "Esteira de Conteúdo", "Feeds RSS" e "Status do Sistema" do menu lateral para usuários não-admin — campo adminOnly no menuItems filtrado por user.role
- [x] Proteger rotas /aprovacao, /feeds, /jobs com redirecionamento para Dashboard se não for admin (useEffect no DashboardLayout)
- [x] Confirmado: usuário Thiago Lucena Santos está como role=admin no banco; upsertUser define admin automaticamente para ownerOpenId

## Landing Page e Página de Planos

- [ ] Criar produtos no Stripe (Morning Call Agro R$ 97/mês, Corporativo R$ 197/mês) com trial de 7 dias
- [ ] Procedure tRPC subscription.createCheckout para gerar sessão Stripe Checkout
- [ ] Webhook Stripe para ativar plano após pagamento
- [ ] Página /pricing pública com comparativo de planos e botão assinar
- [ ] Landing page pública (rota /) com headline, depoimentos e CTA
- [ ] Badge "Admin" discreto no rodapé do sidebar para o usuário admin

## Landing Page, Página de Planos e Badge Admin

- [x] stripe-products.ts: atualizado com 2 planos (morning_call R$97 e corporativo R$197) com trial de 7 dias
- [x] routers.ts: enum planId atualizado para morning_call e corporativo
- [x] Pricing.tsx: redesenhado para 2 planos com grid 2 colunas, ícones, itens não incluídos com X, botão "Começar 7 dias grátis"
- [x] LandingPage.tsx: landing page pública em /landing com hero, features, depoimentos, preview de planos e CTA final
- [x] App.tsx: rota /landing adicionada fora do DashboardLayout (página pública sem sidebar)
- [x] DashboardLayout.tsx: badge "Admin" com ShieldCheck ao lado do nome do usuário no rodapé do sidebar (visível apenas para role=admin)

## Bug Fix: Checkout Stripe

- [x] BUG CORRIGIDO: /pricing estava dentro do DashboardLayout, bloqueando acesso de não-logados com tela "Sign in to continue" antes de ver os planos
- [x] /pricing e /subscription/success movidos para rotas públicas (fora do DashboardLayout)
- [x] Trial de 7 dias adicionado na createCheckoutSession (subscription_data.trial_period_days)
- [x] Webhook e página de sucesso já estavam corretos

## Bug Fix: 404 após pagamento Stripe

- [ ] BUG: página /subscription/success retorna 404 após redirecionamento do Stripe
- [ ] Verificar se o servidor Express está servindo o SPA corretamente para rotas client-side
- [ ] Verificar novo usuário thiago.lucena@plcapital.com.br no banco

## Correções e Melhorias — Sessão Atual (Abril 2026)

- [x] BUG CORRIGIDO: /subscription/success retornava 404 — rotas públicas já estavam corretas no checkpoint 7172fd7a; problema era versão publicada desatualizada
- [x] SubscriptionSuccess.tsx: melhorado para tratar usuário não-logado (exibe botão "Entrar no painel" com getLoginUrl) e usuário logado (botão "Ir para o painel")
- [x] useSubscription.ts: planos atualizados para morning_call e corporativo (removidos planos antigos essencial/estrategico)
- [x] PaywallGate.tsx: PLAN_LABELS atualizado para morning_call e corporativo
- [x] Articles.tsx: PaywallGate aplicado na página de Artigos (exige plano morning_call+)
- [x] Summary.tsx: PaywallGate já estava aplicado (minPlan atualizado para morning_call)
- [x] Commodities.tsx: PaywallGate já estava aplicado (minPlan atualizado para morning_call)
- [x] LandingPage.tsx: já possui CTAs para /pricing (botão "Começar 7 dias grátis" e "Ver planos completos")
- [x] 55 testes passando

## Bug Fix Crítico — PaywallGate e Schema de Planos

- [x] BUG CORRIGIDO: schema.ts atualizado para morning_call/corporativo; migração ALTER TABLE aplicada no banco
- [x] BUG CORRIGIDO: PaywallGate agora verifica role=admin e libera acesso total para admins
- [x] BUG CORRIGIDO: getSubscriptionInfo retorna active=true para admins independente de assinatura
- [x] Assinatura do thiago.lucena@plcapital.com.br ativada manualmente (morning_call, trialing até 19/04/2026)
- [x] stripeWebhook.ts: notificação ao owner (notifyOwner) quando novo usuário assinar via checkout.session.completed

## Bug Fix — Página de Planos sem Sidebar

- [x] BUG CORRIGIDO: /pricing movido para dentro do DashboardLayout com prop allowPublic=true
- [x] DashboardLayout: nova prop allowPublic — quando true e usuário não logado, renderiza children sem sidebar (sem bloqueio de login)
- [x] Usuário logado em /pricing agora vê o sidebar completo; não-logado vê a página sem sidebar
- [x] Botão "Voltar ao painel" removido da Pricing (sidebar já provê navegação)
- [x] /subscription/success também movido para dentro do DashboardLayout com allowPublic

## Nova Funcionalidade — WhatsApp Morning Call (Z-API)

- [x] Schema: adicionados campos phone, profileCompleted, whatsappOptIn na tabela users
- [x] Schema: criada tabela whatsapp_logs para rastrear envios
- [x] Migração ALTER TABLE aplicada no banco via Node.js
- [x] Procedure tRPC profile.update para salvar nome, telefone e whatsappOptIn
- [x] Modal de onboarding obrigatório após primeiro login (nome, e-mail, telefone) — OnboardingModal.tsx
- [x] DashboardLayout: exibe OnboardingModal quando profileCompleted=false
- [x] server/whatsappService.ts criado com sendMorningCallWhatsApp() e buildMorningCallMessage()
- [x] Mensagem formatada com emoji, link para o painel e assinatura Thiago Lucena
- [x] Job agendado às 06:00 BRT no jobs.ts para envio automático
- [x] Página admin /whatsapp-admin com lista de assinantes e botão de envio manual
- [x] Página /perfil para o usuário editar nome, telefone e preferências
- [x] Itens WhatsApp (admin) e Meu Perfil adicionados no sidebar
- [x] Credenciais Z-API configuradas (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)
- [x] Teste vitest validando credenciais Z-API (56 testes passando)

## Bug Fix — WhatsApp Admin

- [x] BUG CORRIGIDO: botão "Enviar Morning Call agora" agora sempre habilitado para admin; aviso se não há texto
- [x] BUG CORRIGIDO: procedure whatsapp.subscribers retorna todos os assinantes ativos/trialing (sem filtro de phone)
- [x] BUG CORRIGIDO: whatsappService.ts usa textToSend (whatsappText ?? fallback do conteúdo) para não bloquear envio
- [x] Preview do texto WhatsApp adicionado na página admin (estilo bolha WhatsApp verde)
- [x] Alertas adicionados: aviso se não há texto gerado, aviso se assinantes sem telefone
- [x] Procedure whatsapp.preview criada para buscar último texto WhatsApp disponível

## Bug Fix — Datas dos Resumos

- [x] BUG CORRIGIDO: summarizer.ts agora usa data BRT (UTC-3) para determinar summaryDate; antes das 06:00 BRT usa ontem
- [x] BUG CORRIGIDO: dayStart/dayEnd agora são BRT-aligned (UTC+03:00 = meia-noite BRT)
- [x] BUG CORRIGIDO: dateStr usa UTC fields do date já alinhado ao BRT, sem offset adicional
- [x] BUG CORRIGIDO: ContentApproval.tsx usa extração segura YYYY-MM-DD sem offset UTC
- [x] BUG CORRIGIDO: Dashboard.tsx usa extração segura YYYY-MM-DD sem offset UTC
- [x] Banco corrigido: registros duplicados/com data errada de 12/04 removidos; id=5220006 corrigido para 2026-04-12

## Bug Fix — WhatsApp Mensagem (13/04/2026)

- [x] BUG CORRIGIDO: query agora busca por summaryDate DESC (mais recente) sem filtro de approvalStatus; prefere registro com whatsappText
- [x] BUG CORRIGIDO: cabeçalho da mensagem removido o "Invalid Date"; novo formato: "🌱 AgroRSS Morning Call\nBom dia, [Nome]! ☀️"
- [x] Preview na página WhatsApp Admin atualizado com o novo cabeçalho sem data

## Nova Funcionalidade — Fluxo Automático WhatsApp + Histórico (13/04/2026)

- [x] Schema: tabela whatsapp_auto_sends criada e migrada no banco (id, sendDate, generatedText, sentAt, totalSent, totalFailed, totalSkipped, status, errorMessage)
- [x] server/whatsappAutoGenerator.ts: generateAutoWhatsAppText() gera texto via IA e salva em whatsapp_auto_sends com status=pending
- [x] server/whatsappAutoGenerator.ts: getAutoSendHistory(limit) retorna histórico de envios
- [x] Job 05:45 BRT: chama generateAutoWhatsAppText() — busca artigos recentes, gera texto WhatsApp via IA, salva no banco
- [x] Job 06:00 BRT: chama sendMorningCallWhatsApp(undefined, overrideText) com texto gerado pelo job 05:45, atualiza status/estatísticas
- [x] Procedures tRPC: whatsapp.autoHistory (lista últimos 30 envios) e whatsapp.generateNow (gera manualmente)
- [x] WhatsApp Admin: botão "Gerar texto agora (IA)" adicionado no header
- [x] WhatsApp Admin: seção "Histórico de envios automáticos" com data, status, contadores e botão de preview do texto
- [x] Texto automático (06:00) é independente do texto da Esteira de Conteúdo (que continua para publicações manuais)
- [x] 56 testes passando sem regressões

## Bug Fix — E-mail e WhatsApp Automático (14/04/2026)

- [ ] BUG: e-mail automático não enviado hoje (14/04) — verificar logs do job de e-mail
- [ ] BUG: WhatsApp automático (05:45/06:00 BRT) não enviado hoje — verificar logs dos jobs
- [ ] Investigar se o servidor reiniciou e perdeu os jobs agendados (node-cron não persiste após restart)
- [ ] Corrigir e disparar envio manual para hoje

## Nova Funcionalidade — Painel Comercial Admin

- [x] Schema: tabelas organizations, organization_members e usage_events criadas e migradas no banco
- [x] server/commercialMetrics.ts criado com getCommercialOverview, getSubscriptionGroups, getAllUsers, getAllOrgs, getMrrHistory, getHourlyUsage, getTopFeatures, getTopPages, trackUsageEvent
- [x] Procedures tRPC: commercial.overview, subscriptionGroups, users, organizations, mrrHistory, hourlyUsage, topFeatures, topPages, trackEvent (todas adminProcedure)
- [x] Página /admin/comercial criada com KPIs (MRR, ARR, usuários, orgs), gráficos AreaChart/BarChart (recharts) e tabelas
- [x] Hook useTrackPageView criado e integrado no DashboardLayoutContent
- [x] Acesso restrito: somente role=admin pode acessar /admin/comercial
- [x] Item "Painel Comercial" adicionado no sidebar (adminOnly, ícone BarChart2)
- [x] 56 testes passando sem regressões

## WhatsApp - Cotações, Link Tokenizado e Paywall por Menu

- [x] Criar tabela `whatsapp_access_tokens` (token, userId, expiresAt, usedAt, createdAt)
- [x] Procedure tRPC: whatsapp.generateAccessToken (cria token de 12h para usuário)
- [x] Procedure tRPC: whatsapp.validateToken (valida token, retorna userId ou erro)
- [x] Atualizar whatsappService.ts: gerar token único por assinante ao enviar Morning Call
- [x] Atualizar buildMorningCallMessage: link personalizado com token (/acesso?token=xxx)
- [x] Atualizar whatsappAutoGenerator.ts: incluir cotações reais no início do texto gerado
- [x] Criar página /acesso no frontend (validação de token, redireciona ou mostra pricing)
- [x] Atualizar DashboardLayout: sidebar mostra todos os itens mas clique valida assinatura
- [x] Reordenar menu lateral: Artigos vai para o final (após Meu Perfil)
- [x] Adicionar rota /acesso no App.tsx

## Correção WhatsApp — Cotações CME/ICE e Sincronização com Site (14/04/2026)

- [x] Corrigir buildCotacoesBlock: cotações no padrão CME/ICE (USD/bu, USX/lb, etc.) igual ao e-mail
- [x] Incluir algódão de Nova York (CT=F, ICE) no bloco de cotações
- [x] Incluir câmbio USD/BRL (fechamento do dia anterior) no bloco de cotações
- [x] Sincronizar texto exibido na aba WhatsApp do site com o texto real enviado no celular
- [x] Garantir que whatsappAutoGenerator.ts usa o mesmo buildCotacoesBlock do whatsappService.ts

## Câmbio em Tempo Real + Trial 7 Dias (14/04/2026)

- [x] buildCommodityBlock: aceitar parâmetro `usePrevClose` (true=fechamento, false=tempo real)
- [x] Envio automático 06:00 usa prevClose; geração manual usa câmbio em tempo real
- [x] Verificar e corrigir fetchUsdBrl para retornar taxa correta (não vinha errada)
- [x] Trial de 7 dias: ao cadastrar, definir trialEndsAt = agora + 7 dias, status = trialing
- [x] Job diário: verificar usuários com trialEndsAt expirado e mudar status para expired
- [x] Bloqueio de acesso: usuários com status expired redirecionados para /pricing
- [x] Notificação ao usuário: banner no dashboard nos últimos 3 dias do trial
- [x] Página /pricing: mostrar aviso de trial expirado quando status = expired (banner no topo)

## Correção Preview WhatsApp (14/04/2026 — v2)

- [x] Corrigir preview da aba WhatsApp: exibir texto idêntico ao enviado no celular
- [x] Remover duplicação do bloco de cotações simples (que aparece depois do bloco CME/ICE)
- [x] Corrigir placeholder [Nome do assinante] no preview (deve mostrar nome real do admin logado)
- [x] Preview deve usar câmbio de fechamento (igual ao envio automático das 06:00)
- [x] Garantir que o texto da IA gerado pelo whatsappAutoGenerator aparece após o bloco CME/ICE

## Correção Morning Call WhatsApp — Esteira como base (14/04/2026 — v3)

- [x] Usar texto da Esteira de Conteúdo (whatsappText de daily_summaries) como base do Morning Call
- [x] Remover whatsappAutoGenerator do fluxo de envio (não gerar texto paralelo pela IA)
- [x] Garantir que o bloco CME/ICE é adicionado UMA VEZ no início, sem duplicação
- [x] Corrigir câmbio USD/BRL: usar USDBRL=X (R$/USD direto) em vez de BRL=X (invertido)
- [x] Atualizar preview da aba WhatsApp para refletir o texto da Esteira
- [x] Manter whatsappAutoGenerator apenas como fallback quando não há texto na Esteira

## E-mail: Desacoplamento do WhatsApp + E-mail Corporativo (14/04/2026)

- [ ] Identificar onde o e-mail é disparado ao atualizar texto WhatsApp
- [ ] Remover gatilho de e-mail da procedure de atualização do texto WhatsApp
- [ ] E-mail só deve ser enviado pelo job das 07:00 BRT (uma vez por dia)
- [ ] Adicionar campo "e-mail corporativo" nas configurações do sistema (admin)
- [ ] Usar e-mail corporativo como remetente/destinatário do briefing diário
- [ ] Garantir que o e-mail corporativo é salvo no banco (tabela system_settings ou similar)

## Botão "Enviar para Assinantes" na Esteira de Conteúdo (14/04/2026)

- [x] Adicionar procedure tRPC `whatsapp.sendFromContent` que recebe o texto da Esteira e envia para todos os assinantes
- [x] Adicionar botão "Enviar para Assinantes" na sub-aba WhatsApp da Esteira de Conteúdo
- [x] Exibir diálogo de confirmação antes do envio (mostrando número de assinantes)
- [x] Exibir feedback do resultado (enviados, falhas, ignorados)

## Correção Duplicação de Cotações no WhatsApp (14/04/2026)

- [x] Identificar onde o segundo bloco de cotações simples (Bom dia! ☀️ / 📊 Cotações) é inserido
- [x] Remover o segundo bloco de cotações — manter apenas o bloco CME/ICE no início
- [x] Garantir que o texto enviado = bloco CME/ICE + texto da Esteira + rodapé com link
- [x] Verificar que o texto da Esteira (AGRO GLOBAL INSIGHTS) não inclui cotações próprias

## Ordenação da Esteira de Conteúdo (15/04/2026)

- [x] Corrigir query de listagem: ordenar por summaryDate DESC, generatedAt DESC (mais recente no topo)

## Aba WhatsApp, Automação 05:45 e Paginação Esteira (15/04/2026)

- [x] Remover seção "Preview — Texto que será enviado" da aba WhatsApp
- [x] Remover botões "Enviar Morning Call Agora" e "Gerar Texto Agora" da aba WhatsApp
- [x] Aba WhatsApp fica exclusiva para monitoramento Z-API (logs, assinantes, status)
- [x] Job 05:45 BRT: gerar automaticamente o texto WhatsApp da Esteira (whatsappText)
- [x] Salvar no histórico (campo sentText em whatsapp_auto_sends) o texto exato enviado às 06:00
- [x] Procedure tRPC: content.getLatest com parâmetros page e pageSize (paginada)
- [x] Adicionar paginação na Esteira de Conteúdo (botões Anterior/Próximo, exibir página atual)
- [x] Manter botões "Copiar texto" e "Regenerar texto" na Esteira

## URGENTE — Loop de Envios WhatsApp (15/04/2026)

- [x] Identificar e parar o loop de envios repetidos do WhatsApp
- [x] Corrigir câmbio USD/BRL errado nas mensagens enviadas
- [x] Garantir que o guard de "já enviado hoje" funciona corretamente (verifica banco, não memória)

## Câmbio e Data no WhatsApp (15/04/2026)

- [x] Câmbio: usar sempre commodity_prices do banco (USDBRL=X) como fonte primária — nunca valor fixo
- [x] Câmbio: fallback para última cotação cadastrada no banco, não valor hardcoded
- [x] Data da mensagem: usar data atual do envio (não data do resumo gerado)

## URGENTE — Envio Duplo e Linguagem do Texto (15/04/2026 — v2)

- [ ] Investigar causa do envio duplo (05:01 e 05:33) — verificar logs do jobs.ts
- [ ] Corrigir guard de envio único para ser mais robusto (verificar banco ANTES de iniciar envio)
- [ ] Atualizar prompt do texto WhatsApp: linguagem de Morning Call (início do dia), não retrospectiva de fim de dia
- [ ] Texto deve começar com perspectiva do dia que está começando, não "foi marcada por..."
