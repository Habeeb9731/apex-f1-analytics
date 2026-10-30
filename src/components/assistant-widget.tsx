import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Github, LogOut, MessageCircle, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';

type AuthStatus = {
  authenticated: boolean;
  configured: boolean;
  chatAvailable: boolean;
  login?: string;
  role?: 'admin' | 'user';
  limit?: number;
  remaining?: number;
};
type ChatAction = { type: 'open_page'; page: string } | { type: 'select_race'; meeting_key: number; name: string };
type ChatMessage = { role: 'user' | 'assistant'; content: string; action?: ChatAction };

// Flip to true once the AI service is deployed; until then the dialog shows a "Coming soon" state.
const ASSISTANT_ENABLED = false;

const pagePaths: Record<string, string> = { overview: '/', race: '/race', compare: '/compare', telemetry: '/telemetry', strategy: '/strategy', standings: '/standings', drivers: '/drivers', circuit: '/circuit', weather: '/weather' };

export function AssistantWidget({ context, onSelectRace }: { context: Record<string, unknown>; onSelectRace: (meetingKey: number) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('assistant_error') === 'not_allowed') {
      setError('This GitHub account has not been invited to use the race analyst.');
      params.delete('assistant_error');
      setOpen(true);
    }
    if (params.get('assistant') === '1') {
      setOpen(true);
      params.delete('assistant');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '', hash: location.hash }, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!open || !ASSISTANT_ENABLED) return;
    let cancelled = false;
    fetch('/api/auth/status', { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error('Could not check sign-in status.');
        return response.json() as Promise<AuthStatus>;
      })
      .then(status => { if (!cancelled) setAuth(status); })
      .catch(() => { if (!cancelled) setError('The local AI service is not running. Start the app with npm run dev.'); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  function beginLogin() {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    window.location.assign(`/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function performAction(action?: ChatAction) {
    if (!action) return;
    if (action.type === 'select_race') {
      const options = Array.isArray(context.grandPrixOptions) ? context.grandPrixOptions as Array<{meeting_key:number}> : [];
      if (!options.some(option => option.meeting_key === action.meeting_key)) return;
      onSelectRace(action.meeting_key);
      setOpen(false);
      return;
    }
    const path = pagePaths[action.page];
    if (!path) return;
    const query = new URLSearchParams(location.search);
    navigate(`${path}${query.toString() ? `?${query.toString()}` : ''}`);
    setOpen(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setAuth(current => current ? { ...current, authenticated: false, login: undefined, role: undefined, remaining: undefined, limit: undefined } : current);
    setMessages([]);
  }

  async function sendMessage(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const content = (suggested ?? draft).trim();
    if (!content || busy) return;
    const prior = messages.slice(-6);
    setMessages(list => [...list, { role: 'user', content }]);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history: prior.map(({ role, content: text }) => ({ role, content: text })), context }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The race analyst could not answer.');
      setMessages(list => [...list, { role: 'assistant', content: data.answer, action: data.action }]);
      setAuth(current => current ? { ...current, remaining: data.remaining } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The race analyst could not answer.');
    } finally {
      setBusy(false);
    }
  }

  const canChat = !!auth?.chatAvailable && auth.remaining !== 0;

  return <>
    <Button size="lg" className="fixed right-5 bottom-5 z-40 rounded-full shadow-lg shadow-primary/20" onClick={() => { setError(''); setOpen(true); }} aria-label="Open Apex race analyst">
      <Sparkles data-icon="inline-start" /> Ask Apex
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[min(720px,90vh)] flex-col gap-4 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4" /></div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <DialogTitle>Apex race analyst</DialogTitle>
            <DialogDescription>Answers grounded in the selected dashboard data.</DialogDescription>
          </div>
          {auth?.authenticated && <Badge variant="outline" className="mr-6 tabular-nums">{auth.remaining}/{auth.limit} today</Badge>}
        </DialogHeader>

        {ASSISTANT_ENABLED ? <>
        {!auth && !error && <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Spinner /> Checking access…</div>}
        {error && <Alert variant="destructive"><AlertDescription role="alert">{error}</AlertDescription></Alert>}

        {auth && !auth.authenticated && <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Github /></EmptyMedia>
            <EmptyTitle>Sign in to use the race analyst</EmptyTitle>
            <EmptyDescription>The dashboard stays public. GitHub sign-in is only needed for AI chat; there is no separate account to create.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {!auth.configured
              ? <Alert><AlertDescription>GitHub sign-in is not enabled yet. Configure the OAuth app, session secret, and allowed GitHub users on the server.</AlertDescription></Alert>
              : <Button onClick={beginLogin}><Github data-icon="inline-start" /> Continue with GitHub</Button>}
            <p className="text-xs text-muted-foreground">Chat requests are limited per GitHub account.</p>
          </EmptyContent>
        </Empty>}

        {auth?.authenticated && <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Signed in as <span className="font-medium text-foreground">@{auth.login}</span>{auth.role === 'admin' ? ' · admin' : ''}</span>
            <Button variant="ghost" size="xs" onClick={logout}><LogOut data-icon="inline-start" /> Sign out</Button>
          </div>
          {!auth.chatAvailable && <Alert><AlertDescription>The OpenAI API key is not configured on the server yet.</AlertDescription></Alert>}
          <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
            <div className="flex min-h-64 flex-col gap-3 pb-1" aria-live="polite">
              {!messages.length && <Empty className="flex-1 p-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Sparkles /></EmptyMedia>
                  <EmptyTitle>What would you like to know?</EmptyTitle>
                  <EmptyDescription>Ask about the selected Grand Prix, race results, or championship standings.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex-row flex-wrap justify-center">
                  <Button variant="outline" size="sm" disabled={!canChat} onClick={() => void sendMessage(undefined, 'Summarize the selected Grand Prix.')}>Summarize this race</Button>
                  <Button variant="outline" size="sm" disabled={!canChat} onClick={() => void sendMessage(undefined, 'What stands out in the current championship standings?')}>Explain the standings</Button>
                </EmptyContent>
              </Empty>}
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={cn('flex max-w-[85%] flex-col gap-1.5', message.role === 'user' ? 'self-end items-end' : 'self-start items-start')}>
                  <span className="text-[10px] font-medium tracking-wider text-muted-foreground">{message.role === 'assistant' ? 'APEX' : 'YOU'}</span>
                  <p className={cn('rounded-lg px-3 py-2 text-sm whitespace-pre-wrap', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{message.content}</p>
                  {message.action?.type === 'open_page' && <Button variant="outline" size="xs" onClick={() => performAction(message.action)}>Open {message.action.page}</Button>}
                  {message.action?.type === 'select_race' && <Button variant="outline" size="xs" onClick={() => performAction(message.action)}>Select {message.action.name}</Button>}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"><Spinner /> Checking the session data…</div>}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          <form onSubmit={sendMessage}>
            <InputGroup>
              <InputGroupTextarea value={draft} onChange={event => setDraft(event.target.value.slice(0, 1500))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} maxLength={1500} placeholder="Ask about this race…" aria-label="Ask the race analyst" disabled={busy || !canChat} rows={2} />
              <InputGroupAddon align="block-end">
                <InputGroupText className="text-xs"><MessageCircle /> Historical OpenF1 data · answers may be incomplete</InputGroupText>
                <InputGroupButton type="submit" variant="default" size="icon-xs" className="ml-auto rounded-full" aria-label="Send question" disabled={busy || !draft.trim() || !canChat}><Send /></InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </>}
        </> : <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Sparkles /></EmptyMedia>
            <EmptyTitle>Coming soon</EmptyTitle>
            <EmptyDescription>The Apex race analyst is on its way. Soon you'll be able to ask questions about races, results and standings right here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Got it</Button>
          </EmptyContent>
        </Empty>}
      </DialogContent>
    </Dialog>
  </>;
}
