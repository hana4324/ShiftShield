import { MessagesList } from "@/components/MessagesList";
import { Screen, ScreenTitle } from "@/components/ui/Screen";

export default function OfficerMessages() {
  return (
    <Screen tone="dark">
      <ScreenTitle title="Messages" subtitle="One thread per shift with the employer team" />
      <MessagesList />
    </Screen>
  );
}
