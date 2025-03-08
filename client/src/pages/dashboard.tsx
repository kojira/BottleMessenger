import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Settings, type Message } from "@shared/schema";

export default function Dashboard() {
  const { data: settings } = useQuery<Settings>({ 
    queryKey: ["/api/settings"]
  });

  const { data: messages } = useQuery<Message[]>({ 
    queryKey: ["/api/messages", { limit: 5 }]
  });

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