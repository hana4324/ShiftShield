import { MessagesList } from "@/components/MessagesList";
import { Screen, ScreenTitle } from "@/components/ui/Screen";

export default function EmployerMessages() {
  return (
    <Screen tone="dark">
      <ScreenTitle title="Messages" subtitle="One thread per shift with booked officers" />
      <MessagesList />
    </Screen>
  );
}
