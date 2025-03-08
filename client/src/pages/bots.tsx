import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, insertBotSchema, platformSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Bots() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: bots, isLoading } = useQuery<Bot[]>({
    queryKey: ["/api/bots"],
  });

  const form = useForm({
    resolver: zodResolver(insertBotSchema),
    defaultValues: {
      platform: "bluesky",
      identifier: "",
      credentials: {},
      active: "true",
    },
  });

  const createBot = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/bots", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      setOpen(false);
      toast({
        title: "Success",
        description: "Bot created successfully",
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

  const toggleBot = useMutation({
    mutationFn: async (bot: Bot) => {
      await apiRequest("PATCH", `/api/bots/${bot.id}`, {
        active: bot.active === "true" ? "false" : "true",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Bots</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Bot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Bot</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createBot.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {platformSchema.options.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {platform}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identifier</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createBot.isPending}>
                  Create Bot
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {bots?.map((bot) => (
          <div
            key={bot.id}
            className="p-4 border rounded-lg flex items-center justify-between"
          >
            <div>
              <p className="font-medium">{bot.identifier}</p>
              <p className="text-sm text-muted-foreground">{bot.platform}</p>
            </div>
            <Button
              variant={bot.active === "true" ? "default" : "outline"}
              onClick={() => toggleBot.mutate(bot)}
            >
              {bot.active === "true" ? "Active" : "Inactive"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
