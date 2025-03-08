import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Message } from "@shared/schema";

export default function Dashboard() {
  const { data: bots } = useQuery<Bot[]>({ 
    queryKey: ["/api/bots"]
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
            <CardTitle>Active Bots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bots?.filter(b => b.active === 'true').map(bot => (
                <div key={bot.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{bot.identifier}</p>
                    <p className="text-sm text-muted-foreground">{bot.platform}</p>
                  </div>
                </div>
              ))}
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
