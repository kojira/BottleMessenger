import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Settings, type Message } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: settings } = useQuery<Settings>({ 
    queryKey: ["/api/settings"]
  });

  const { data: messages } = useQuery<Message[]>({ 
    queryKey: ["/api/messages", { limit: 5 }]
  });

  const sendTestDM = useMutation({
    mutationFn: async (data: { platform: string; content: string }) => {
      await apiRequest("POST", "/api/test/dm", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "テストDMを送信しました",
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

  const handleTestDM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const platform = formData.get("platform") as string;
    const content = formData.get("content") as string;

    if (!platform || !content) {
      toast({
        title: "Error",
        description: "プラットフォームとメッセージを入力してください",
        variant: "destructive",
      });
      return;
    }

    sendTestDM.mutate({ platform, content });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bot Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Bluesky Bot</p>
                  <p className="text-sm text-muted-foreground">{settings?.blueskyHandle}</p>
                </div>
                <span className={settings?.enabled === 'true' ? 'text-green-500' : 'text-red-500'}>
                  {settings?.enabled === 'true' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nostr Bot</p>
                  <p className="text-sm text-muted-foreground">
                    {settings?.nostrPrivateKey ? '設定済み' : '未設定'}
                  </p>
                </div>
                <span className={settings?.enabled === 'true' ? 'text-green-500' : 'text-red-500'}>
                  {settings?.enabled === 'true' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test DM</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTestDM} className="space-y-4">
              <div>
                <Select name="platform">
                  <SelectTrigger>
                    <SelectValue placeholder="プラットフォームを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bluesky">Bluesky</SelectItem>
                    <SelectItem value="nostr">Nostr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  name="content"
                  placeholder="メッセージを入力"
                  className="w-full"
                />
              </div>
              <Button
                type="submit"
                disabled={sendTestDM.isPending}
                className="w-full"
              >
                {sendTestDM.isPending ? "送信中..." : "テストDMを送信"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages?.map(msg => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{msg.sourceUser}</p>
                    <span className={
                      msg.status === 'sent' ? 'text-green-500' :
                      msg.status === 'failed' ? 'text-red-500' :
                      'text-yellow-500'
                    }>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}