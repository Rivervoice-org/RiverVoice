export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: {
          gender: Database["public"]["Enums"]["agent_gender"]
          id: string
          input_language: Database["public"]["Enums"]["language"]
          mascot: string
          mode: Database["public"]["Enums"]["agent_mode"]
          name: string
          output_language: Database["public"]["Enums"]["language"]
          user_id: string
          voice: string
        }
        Insert: {
          gender: Database["public"]["Enums"]["agent_gender"]
          id?: string
          input_language: Database["public"]["Enums"]["language"]
          mascot: string
          mode: Database["public"]["Enums"]["agent_mode"]
          name: string
          output_language: Database["public"]["Enums"]["language"]
          user_id: string
          voice: string
        }
        Update: {
          gender?: Database["public"]["Enums"]["agent_gender"]
          id?: string
          input_language?: Database["public"]["Enums"]["language"]
          mascot?: string
          mode?: Database["public"]["Enums"]["agent_mode"]
          name?: string
          output_language?: Database["public"]["Enums"]["language"]
          user_id?: string
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      call_utterances: {
        Row: {
          call_id: string
          created_at: string
          duration_ms: number | null
          id: number
          offset_ms: number | null
          original_language: Database["public"]["Enums"]["language"] | null
          original_text: string
          seq: number
          speaker: Database["public"]["Enums"]["call_speaker"]
          translated_duration_ms: number | null
          translated_language: Database["public"]["Enums"]["language"] | null
          translated_offset_ms: number | null
          translated_text: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          duration_ms?: number | null
          id?: number
          offset_ms?: number | null
          original_language?: Database["public"]["Enums"]["language"] | null
          original_text: string
          seq: number
          speaker: Database["public"]["Enums"]["call_speaker"]
          translated_duration_ms?: number | null
          translated_language?: Database["public"]["Enums"]["language"] | null
          translated_offset_ms?: number | null
          translated_text?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          duration_ms?: number | null
          id?: number
          offset_ms?: number | null
          original_language?: Database["public"]["Enums"]["language"] | null
          original_text?: string
          seq?: number
          speaker?: Database["public"]["Enums"]["call_speaker"]
          translated_duration_ms?: number | null
          translated_language?: Database["public"]["Enums"]["language"] | null
          translated_offset_ms?: number | null
          translated_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_utterances_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          billable_seconds: number
          connected_at: string | null
          cost_micros: number
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"]
          end_reason: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at: string | null
          error: string | null
          from_number: string
          id: string
          input_language: Database["public"]["Enums"]["language"] | null
          output_language: Database["public"]["Enums"]["language"] | null
          provider_call_ref: string | null
          recording_path: string | null
          ringing_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          telephony_provider: string | null
          to_number: string
          translated_recording_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          billable_seconds?: number
          connected_at?: string | null
          cost_micros?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          end_reason?: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at?: string | null
          error?: string | null
          from_number: string
          id: string
          input_language?: Database["public"]["Enums"]["language"] | null
          output_language?: Database["public"]["Enums"]["language"] | null
          provider_call_ref?: string | null
          recording_path?: string | null
          ringing_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          telephony_provider?: string | null
          to_number: string
          translated_recording_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          billable_seconds?: number
          connected_at?: string | null
          cost_micros?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          end_reason?: Database["public"]["Enums"]["call_end_reason"] | null
          ended_at?: string | null
          error?: string | null
          from_number?: string
          id?: string
          input_language?: Database["public"]["Enums"]["language"] | null
          output_language?: Database["public"]["Enums"]["language"] | null
          provider_call_ref?: string | null
          recording_path?: string | null
          ringing_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          telephony_provider?: string | null
          to_number?: string
          translated_recording_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seaql_migrations: {
        Row: {
          applied_at: number
          version: string
        }
        Insert: {
          applied_at: number
          version: string
        }
        Update: {
          applied_at?: number
          version?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          mascot: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          mascot: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          mascot?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agent_gender: "female" | "male" | "neutral"
      agent_mode:
        | "formal"
        | "modern-colloquial"
        | "classic-colloquial"
        | "code-mixed"
      call_direction: "outbound" | "inbound"
      call_end_reason:
        | "busy"
        | "no_answer"
        | "failed"
        | "hung_up_by_a"
        | "hung_up_by_b"
      call_speaker: "caller" | "callee"
      call_status: "dialing" | "ringing" | "connected" | "ended"
      language: "en" | "hi" | "te" | "ta" | "kn"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_gender: ["female", "male", "neutral"],
      agent_mode: [
        "formal",
        "modern-colloquial",
        "classic-colloquial",
        "code-mixed",
      ],
      call_direction: ["outbound", "inbound"],
      call_end_reason: [
        "busy",
        "no_answer",
        "failed",
        "hung_up_by_a",
        "hung_up_by_b",
      ],
      call_speaker: ["caller", "callee"],
      call_status: ["dialing", "ringing", "connected", "ended"],
      language: ["en", "hi", "te", "ta", "kn"],
    },
  },
} as const
