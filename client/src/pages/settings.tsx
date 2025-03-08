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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
      enabled: "true",
    },
    values: settings || undefined,
  });

  const updateSettings = useMutation({
    mutationFn: async (data: any) => {
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