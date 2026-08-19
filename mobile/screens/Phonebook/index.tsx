import { View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Globe } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { SERVICE_COLORS, TELEPHONY_SERVICES } from "./mock";

function ServiceIcon({ icon, name }: { icon: string; name: string }) {
  const color = SERVICE_COLORS[icon] || "#8f8c87";
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: color + "14",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color }}>{name[0]}</Text>
    </View>
  );
}

export default function PhonebookScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-3 pb-1">
        <Text className="text-[28px] font-semibold tracking-[-0.02em]">
          Phonebook
        </Text>
        <Text variant="muted" className="mt-1 text-sm">
          Telephony providers & service numbers
        </Text>
      </View>

      {/* Services list */}
      <View className="mt-4 px-5">
        <Card className="overflow-hidden">
          {TELEPHONY_SERVICES.map((service, index) => (
            <Pressable
              key={service.id}
              onPress={() => {}}
              className={`flex-row items-center gap-3 px-3.5 py-3 ${
                index < TELEPHONY_SERVICES.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <ServiceIcon icon={service.icon} name={service.name} />
              <View className="flex-1">
                <Text className="text-[15px] font-medium">{service.name}</Text>
                <Badge variant="secondary" className="mt-1 self-start px-2 py-0.5">
                  {service.type}
                </Badge>
              </View>
              <Text font="mono" variant="muted" className="text-[13px]">
                {service.number}
              </Text>
            </Pressable>
          ))}
        </Card>
      </View>

      {/* Info card */}
      <Card className="mx-5 mt-6 p-4">
        <View className="mb-2 flex-row items-center gap-2">
          <Globe size={16} strokeWidth={1.75} color="#3b5dab" />
          <Text className="text-[13px] font-semibold">About Telephony Providers</Text>
        </View>
        <Text variant="muted" className="text-[13px] leading-5">
          These are the cloud telephony services that power your Rivervoice
          agents. Each provider handles voice translation calls across 23+ languages
          with real-time switching.
        </Text>
      </Card>
    </SafeAreaView>
  );
}
