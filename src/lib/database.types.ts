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
      ai_reports: {
        Row: {
          content: string
          created_at: string
          entry_id: string
          id: string
          model: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_id: string
          id?: string
          model: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_id?: string
          id?: string
          model?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reports_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_wellness_scores"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          api_key: string
          model: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          model: string
          provider: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          api_key?: string
          model?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          reflection: string
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          reflection?: string
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          reflection?: string
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entry_habits: {
        Row: {
          done: boolean
          entry_id: string
          habit_id: string
        }
        Insert: {
          done?: boolean
          entry_id: string
          habit_id: string
        }
        Update: {
          done?: boolean
          entry_id?: string
          habit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_habits_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_habits_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_wellness_scores"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_habits_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_metric_values: {
        Row: {
          entry_id: string
          metric_id: string
          value: number
        }
        Insert: {
          entry_id: string
          metric_id: string
          value: number
        }
        Update: {
          entry_id?: string
          metric_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_metric_values_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_metric_values_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entry_wellness_scores"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_metric_values_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived: boolean
          id: string
          key: string
          label: string
          note: string | null
          progress: number
          sort_order: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          id?: string
          key: string
          label: string
          note?: string | null
          progress?: number
          sort_order?: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          id?: string
          key?: string
          label?: string
          note?: string | null
          progress?: number
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          archived: boolean
          id: string
          key: string
          label: string
          sort_order: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          id?: string
          key: string
          label: string
          sort_order?: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          id?: string
          key?: string
          label?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      metrics: {
        Row: {
          archived: boolean
          group_name: string
          higher_is_better: boolean
          id: string
          key: string
          label: string
          scale: number
          sort_order: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          group_name: string
          higher_is_better?: boolean
          id?: string
          key: string
          label: string
          scale?: number
          sort_order?: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          group_name?: string
          higher_is_better?: boolean
          id?: string
          key?: string
          label?: string
          scale?: number
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          name: string
          sort_order: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          sort_order?: number
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      retro_areas: {
        Row: {
          archived: boolean
          id: string
          key: string
          label: string
          sort_order: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          id?: string
          key: string
          label: string
          sort_order?: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          id?: string
          key?: string
          label?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      retros: {
        Row: {
          ai_summary: string | null
          area_id: string
          created_at: string
          doc_md: string
          id: string
          model: string | null
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          area_id: string
          created_at?: string
          doc_md: string
          id?: string
          model?: string | null
          user_id?: string
        }
        Update: {
          ai_summary?: string | null
          area_id?: string
          created_at?: string
          doc_md?: string
          id?: string
          model?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retros_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "retro_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          completed_at: string | null
          created_at: string
          id: string
          scope: string
          size: string
          sort_order: number
          text: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          scope: string
          size?: string
          sort_order?: number
          text: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          scope?: string
          size?: string
          sort_order?: number
          text?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      entry_wellness_scores: {
        Row: {
          entry_id: string | null
          wellness: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

