import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Message } from "@shared/schema";

export default function Messages() {
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Messages</h1>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages?.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{message.sourceUser}</p>
                    <p className="text-sm text-muted-foreground">
                      {message.sourcePlatform}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground">
                    {message.targetPlatform}
                  </p>
                </TableCell>
                <TableCell className="max-w-md truncate">
                  {message.content}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      message.status === "sent"
                        ? "text-green-500"
                        : message.status === "failed"
                        ? "text-red-500"
                        : "text-yellow-500"
                    }
                  >
                    {message.status}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(message.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
