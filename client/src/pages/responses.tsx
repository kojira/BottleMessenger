import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type BotResponse,
  insertBotResponseSchema,
  responseTypeSchema,
  platformSchema,
} from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function ResponsesPage() {
  const { toast } = useToast();

  const { data: responses, isLoading } = useQuery<BotResponse[]>({
    queryKey: ["/api/responses"],
  });

  const form = useForm({
    resolver: zodResolver(insertBotResponseSchema),
    defaultValues: {
      platform: "bluesky",
      responseType: "welcome",
      message: "",
    },
  });

  const createResponse = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/responses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/responses"] });
      form.reset();
      toast({
        title: "Success",
        description: "応答メッセージを追加しました",
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

  const deleteResponse = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/responses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/responses"] });
      toast({
        title: "Success",
        description: "応答メッセージを削除しました",
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
      <h1 className="text-3xl font-bold">Bot応答メッセージ設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>新規メッセージ追加</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createResponse.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>プラットフォーム</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="プラットフォームを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bluesky">Bluesky</SelectItem>
                        <SelectItem value="nostr">Nostr</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>応答タイプ</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="応答タイプを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="welcome">ウェルカムメッセージ</SelectItem>
                        <SelectItem value="help">ヘルプ</SelectItem>
                        <SelectItem value="bottle_sent">ボトル送信完了</SelectItem>
                        <SelectItem value="bottle_received">ボトル受信</SelectItem>
                        <SelectItem value="reply_sent">返信送信完了</SelectItem>
                        <SelectItem value="error">エラー</SelectItem>
                        <SelectItem value="stats">統計情報</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メッセージ</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="応答メッセージを入力"
                        className="h-32"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={createResponse.isPending}
              >
                追加
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録済みメッセージ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>プラットフォーム</TableHead>
                <TableHead>応答タイプ</TableHead>
                <TableHead>メッセージ</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses?.map((response) => (
                <TableRow key={response.id}>
                  <TableCell>{response.platform}</TableCell>
                  <TableCell>{response.responseType}</TableCell>
                  <TableCell>{response.message}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteResponse.mutate(response.id)}
                      disabled={deleteResponse.isPending}
                    >
                      削除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ResponsesPage;
