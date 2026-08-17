import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Phone, ChevronRight, Globe, Wifi, Server, Headphones } from "lucide-react-native";

const TELEPHONY_SERVICES = [
  {
    id: "1",
    name: "Twilio",
    number: "+1 888 799 9666",
    type: "VoIP Provider",
    icon: "twilio",
  },
  {
    id: "2",
    name: "Vobiz",
    number: "+91 80 4567 8901",
    type: "Cloud Telephony",
    icon: "vobiz",
  },
  {
    id: "3",
    name: "Exotel",
    number: "+91 80 6754 3210",
    type: "Cloud Telephony",
    icon: "exotel",
  },
  {
    id: "4",
    name: "Plivo",
    number: "+1 800 970 5238",
    type: "VoIP Provider",
    icon: "plivo",
  },
  {
    id: "5",
    name: "Telnyx",
    number: "+1 888 979 5273",
    type: "VoIP Provider",
    icon: "telnyx",
  },
  {
    id: "6",
    name: "Vonage",
    number: "+1 866 512 7777",
    type: "Cloud Communication",
    icon: "vonage",
  },
];

const SERVICE_COLORS: Record<string, string> = {
  twilio: "#F22F46",
  vobiz: "#3b5dab",
  exotel: "#1DB9C1",
  plivo: "#25B76F",
  telnyx: "#7B61FF",
  vonage: "#00B9F1",
};

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
      <Text style={{ fontSize: 16, fontWeight: "700", color }}>
        {name[0]}
      </Text>
    </View>
  );
}

export default function PhonebookScreen() {

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "600",
            letterSpacing: -0.5,
            color: "#2e2a25",
          }}
        >
          Phonebook
        </Text>
        <Text style={{ fontSize: 14, color: "#8f8c87", marginTop: 4 }}>
          Telephony providers & service numbers
        </Text>
      </View>

      {/* Services list */}
      <View style={{ marginTop: 16, marginHorizontal: 20 }}>
        {TELEPHONY_SERVICES.map((service, index) => (
          <Pressable
            key={service.id}
            onPress={() => {}}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#fff",
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderTopLeftRadius: index === 0 ? 14 : 0,
              borderTopRightRadius: index === 0 ? 14 : 0,
              borderBottomLeftRadius: index === TELEPHONY_SERVICES.length - 1 ? 14 : 0,
              borderBottomRightRadius: index === TELEPHONY_SERVICES.length - 1 ? 14 : 0,
              borderBottomWidth: index < TELEPHONY_SERVICES.length - 1 ? 1 : 0,
              borderBottomColor: "#f0eeeb",
            }}
          >
            <ServiceIcon icon={service.icon} name={service.name} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: "#2e2a25" }}>
                {service.name}
              </Text>
              <Text style={{ fontSize: 12, color: "#8f8c87", marginTop: 1 }}>
                {service.type}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "400",
                color: "#8f8c87",
                fontFamily: "monospace",
              }}
            >
              {service.number}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Info card */}
      <View
        style={{
          marginTop: 24,
          marginHorizontal: 20,
          padding: 16,
          backgroundColor: "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#ebe9e6",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Globe size={16} strokeWidth={1.75} color="#3b5dab" />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#2e2a25" }}>
            About Telephony Providers
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: "#8f8c87", lineHeight: 20 }}>
          These are the cloud telephony services that power your Rivervoice
          agents. Each provider handles voice translation calls across 23+ languages
          with real-time switching.
        </Text>
      </View>
    </SafeAreaView>
  );
}
