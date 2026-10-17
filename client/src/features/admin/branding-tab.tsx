import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ImagePlus, Palette, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { WALLPAPER_PRESETS, hexToHsl } from "@/components/layout/auth-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fileToResizedDataUrl } from "@/lib/image";
import { cleanError } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOrganization, type OrgInfo } from "./use-admin-data";

const COLOUR_PRESETS = ["#4f46e5", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#111827"];

type Form = {
  logoUrl: string | null;
  brandColor: string | null;
  wallpaperUrl: string | null;
  wallpaperPreset: string | null;
  welcomeTitle: string;
  welcomeMessage: string;
};

const fromOrg = (o?: OrgInfo): Form => ({
  logoUrl: o?.logoUrl ?? null,
  brandColor: o?.brandColor ?? null,
  wallpaperUrl: o?.wallpaperUrl ?? null,
  wallpaperPreset: o?.wallpaperPreset ?? null,
  welcomeTitle: o?.welcomeTitle ?? "",
  welcomeMessage: o?.welcomeMessage ?? "",
});

export function BrandingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org, isLoading } = useOrganization();
  const [form, setForm] = useState<Form>(fromOrg());
  const [busy, setBusy] = useState<"logo" | "wallpaper" | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const wallInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (org) setForm(fromOrg(org));
  }, [org?.id, org?.logoUrl, org?.brandColor, org?.wallpaperUrl, org?.wallpaperPreset, org?.welcomeTitle, org?.welcomeMessage]);

  const save = useMutation({
    mutationFn: async (data: Form) =>
      apiRequest("/api/organization/branding", {
        method: "PUT",
        body: { ...data, welcomeTitle: data.welcomeTitle.trim() || null, welcomeMessage: data.welcomeMessage.trim() || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      toast({ title: "Branding saved", description: "Your employee login page has been updated." });
    },
    onError: (e) => toast({ title: "Couldn't save branding", description: cleanError(e), variant: "destructive" }),
  });

  const pickFile = async (kind: "logo" | "wallpaper", file?: File) => {
    if (!file) return;
    setBusy(kind);
    try {
      if (kind === "logo") {
        const url = await fileToResizedDataUrl(file, { maxSize: 512, mime: file.type === "image/png" ? "image/png" : "image/webp", quality: 0.9, maxBytes: 600 * 1024 });
        setForm((f) => ({ ...f, logoUrl: url }));
      } else {
        const url = await fileToResizedDataUrl(file, { maxSize: 1800, mime: "image/jpeg", quality: 0.82, maxBytes: 2400 * 1024 });
        setForm((f) => ({ ...f, wallpaperUrl: url, wallpaperPreset: null }));
      }
    } catch (e) {
      toast({ title: "Couldn't use that image", description: cleanError(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !org) return <Skeleton className="h-96 w-full" />;

  const link = `${window.location.origin}/org/${org.slug}`;
  const dirty = JSON.stringify(form) !== JSON.stringify(fromOrg(org));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" /> Employee login page
            </CardTitle>
            <CardDescription>
              This is what your staff see at <code className="rounded bg-muted px-1 py-0.5 text-xs">{link}</code>. Your logo also appears in their app header.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40">
                  {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="max-h-16 max-w-[7rem] object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => logoInput.current?.click()} disabled={busy === "logo"}>
                    <Upload className="h-4 w-4" /> {busy === "logo" ? "Processing…" : form.logoUrl ? "Replace" : "Upload logo"}
                  </Button>
                  {form.logoUrl && (
                    <Button type="button" variant="ghost" onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickFile("logo", e.target.files?.[0])} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG with a transparent background works best. Resized automatically.</p>
            </div>

            {/* Colour */}
            <div className="space-y-2">
              <Label>Brand colour</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOUR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setForm((f) => ({ ...f, brandColor: c }))}
                    className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110", form.brandColor === c ? "border-foreground" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
                <label className="ml-2 flex items-center gap-2 text-sm">
                  <input type="color" value={form.brandColor ?? "#4f46e5"} onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))} className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0" />
                  <Input value={form.brandColor ?? ""} placeholder="#4f46e5" onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value || null }))} className="h-8 w-28 font-mono text-xs" />
                </label>
                {form.brandColor && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, brandColor: null }))}>
                    Default
                  </Button>
                )}
              </div>
            </div>

            {/* Wallpaper */}
            <div className="space-y-2">
              <Label>Background</Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, wallpaperPreset: null, wallpaperUrl: null }))}
                  className={cn("flex aspect-[4/3] items-center justify-center rounded-lg border-2 bg-background text-[11px] text-muted-foreground", !form.wallpaperPreset && !form.wallpaperUrl ? "border-foreground" : "border-border")}
                >
                  None
                </button>
                {Object.entries(WALLPAPER_PRESETS).map(([id, css]) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={id}
                    title={id}
                    onClick={() => setForm((f) => ({ ...f, wallpaperPreset: id, wallpaperUrl: null }))}
                    className={cn("aspect-[4/3] rounded-lg border-2 transition-transform hover:scale-105", form.wallpaperPreset === id ? "border-foreground" : "border-transparent")}
                    style={{ backgroundImage: css }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => wallInput.current?.click()}
                  disabled={busy === "wallpaper"}
                  className={cn("flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/40 text-muted-foreground", form.wallpaperUrl ? "border-foreground" : "border-border")}
                  style={form.wallpaperUrl ? { backgroundImage: `url(${form.wallpaperUrl})`, backgroundSize: "cover" } : undefined}
                >
                  {!form.wallpaperUrl && <ImagePlus className="h-5 w-5" />}
                </button>
                <input ref={wallInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickFile("wallpaper", e.target.files?.[0])} />
              </div>
              <p className="text-xs text-muted-foreground">Pick a gradient or upload a photo (your shopfront, your team). Photos are resized to keep the page fast.</p>
            </div>

            {/* Copy */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="welcomeTitle">Headline</Label>
                <Input id="welcomeTitle" maxLength={80} placeholder={org.name} value={form.welcomeTitle} onChange={(e) => setForm((f) => ({ ...f, welcomeTitle: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="welcomeMessage">Message</Label>
                <Textarea id="welcomeMessage" maxLength={240} rows={2} placeholder="Sign in to clock in and see your shifts" value={form.welcomeMessage} onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button onClick={() => save.mutate(form)} disabled={!dirty || save.isPending || !!busy}>
                <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save branding"}
              </Button>
              <Button variant="ghost" onClick={() => setForm(fromOrg(org))} disabled={!dirty}>
                <RotateCcw className="h-4 w-4" /> Discard changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
        <BrandPreview org={org} form={form} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Open the real page
          </a>{" "}
          to see the full version.
        </p>
      </div>
    </div>
  );
}

function BrandPreview({ org, form }: { org: OrgInfo; form: Form }) {
  const hasWallpaper = !!(form.wallpaperUrl || (form.wallpaperPreset && WALLPAPER_PRESETS[form.wallpaperPreset]));
  const bg = form.wallpaperUrl
    ? { backgroundImage: `url(${form.wallpaperUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : form.wallpaperPreset
      ? { backgroundImage: WALLPAPER_PRESETS[form.wallpaperPreset] }
      : undefined;
  const vars = form.brandColor ? ({ "--brand-from": hexToHsl(form.brandColor), "--brand-to": hexToHsl(form.brandColor, 18), "--primary": hexToHsl(form.brandColor) } as React.CSSProperties) : undefined;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border", !hasWallpaper && "glow-bg bg-background")} style={{ ...bg, ...vars }}>
      {hasWallpaper && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative px-6 py-8 text-center">
        {form.logoUrl ? (
          <img src={form.logoUrl} alt="" className="mx-auto mb-3 h-10 max-w-[140px] object-contain drop-shadow" />
        ) : (
          <div className="brand-gradient mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
            <Building2 className="h-5 w-5 text-white" />
          </div>
        )}
        <p className={cn("text-lg font-bold", hasWallpaper && "text-white")}>{form.welcomeTitle.trim() || org.name}</p>
        <p className={cn("mt-0.5 text-xs text-muted-foreground", hasWallpaper && "text-white/80")}>{form.welcomeMessage.trim() || "Sign in to clock in and see your shifts"}</p>
        <div className="glass mx-auto mt-5 max-w-[260px] space-y-2 rounded-xl p-4 text-left">
          <div className="h-2 w-10 rounded bg-muted-foreground/30" />
          <div className="h-8 rounded-lg border border-input bg-background/60" />
          <div className="h-2 w-14 rounded bg-muted-foreground/30" />
          <div className="h-8 rounded-lg border border-input bg-background/60" />
          <div className="brand-gradient mt-1 flex h-8 items-center justify-center rounded-lg text-xs font-medium text-white">Sign in →</div>
        </div>
        <p className={cn("mt-4 text-[10px] text-muted-foreground", hasWallpaper && "text-white/60")}>Powered by Clock-In Pro</p>
      </div>
    </div>
  );
}
