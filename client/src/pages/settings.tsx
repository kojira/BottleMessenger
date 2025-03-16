import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Settings, settingsSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      blueskyHandle: "",
      blueskyPassword: "",
      nostrPrivateKey: "",
      nostrRelays: "",
      enabled: "true",
      autoStart: "false",
      blueskyIgnoreBeforeTime: undefined,
      botStatus: "stopped",
    },
    values: settings || undefined,
  });

  const updateSettings = useMutation({
    mutationFn: async (data: any) => {
      // JSONとして有効なリレーリストかチェック
      try {
        const relays = JSON.parse(data.nostrRelays);
        if (!Array.isArray(relays)) {
          throw new Error("Relays must be a JSON array");
        }
        for (const relay of relays) {
          if (typeof relay !== "string" || !relay.startsWith("wss://")) {
            throw new Error("Each relay must be a WebSocket URL starting with wss://");
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Invalid relay format. Please enter a valid JSON array of WebSocket URLs.",
          variant: "destructive",
        });
        return;
      }

      await apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bot Settings</h1>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))}
          className="space-y-4 max-w-md"
        >
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Bluesky Account</h2>
            <FormField
              control={form.control}
              name="blueskyHandle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Handle</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="blueskyPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Nostr Account</h2>
            <FormField
              control={form.control}
              name="nostrPrivateKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private Key</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nostrRelays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relays (JSON array)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='["wss://relay.damus.io", "wss://nos.lol"]' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Bot Settings</h2>
            <FormField
              control={form.control}
              name="autoStart"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">自動起動</FormLabel>
                    <FormDescription>
                      アプリケーション起動時にボットを自動的に起動します
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === "true"}
                      onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="blueskyIgnoreBeforeTime"
              render={({ field }) => (
                <FormItem className="border p-4 rounded-lg">
                  <FormLabel className="text-base">Bluesky 無視する時刻</FormLabel>
                  <FormDescription>
                    この時刻より前のDMは処理されません（空白の場合はすべて処理）
                  </FormDescription>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ""}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value).getTime() : undefined;
                        field.onChange(date);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={updateSettings.isPending}
          >
            Save Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default SettingsPage;
