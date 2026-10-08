export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      acompanhamento: {
        Row: {
          cirurgias: number | null
          cliente_id: string
          comparecimentos: number | null
          consultas_agendadas: number | null
          id: string
          ordem: number
          raw: Json | null
          semana_inicio: string | null
          semana_label: string | null
          vendas: number | null
        }
        Insert: {
          cirurgias?: number | null
          cliente_id: string
          comparecimentos?: number | null
          consultas_agendadas?: number | null
          id?: string
          ordem?: number
          raw?: Json | null
          semana_inicio?: string | null
          semana_label?: string | null
          vendas?: number | null
        }
        Update: {
          cirurgias?: number | null
          cliente_id?: string
          comparecimentos?: number | null
          consultas_agendadas?: number | null
          id?: string
          ordem?: number
          raw?: Json | null
          semana_inicio?: string | null
          semana_label?: string | null
          vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          created_at: string
          hunter: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          layout: string
          meta_mensal_override: number | null
          nome: string
          performance: string | null
          share_token: string | null
          spreadsheet_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          hunter?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          layout?: string
          meta_mensal_override?: number | null
          nome: string
          performance?: string | null
          share_token?: string | null
          spreadsheet_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          hunter?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          layout?: string
          meta_mensal_override?: number | null
          nome?: string
          performance?: string | null
          share_token?: string | null
          spreadsheet_id?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          dominio_permitido: string | null
          id: number
          logo_url: string | null
          pct_atlas: number
          pct_hunter: number
          pct_performance: number
          pct_total: number
          updated_at: string
        }
        Insert: {
          dominio_permitido?: string | null
          id?: number
          logo_url?: string | null
          pct_atlas?: number
          pct_hunter?: number
          pct_performance?: number
          pct_total?: number
          updated_at?: string
        }
        Update: {
          dominio_permitido?: string | null
          id?: number
          logo_url?: string | null
          pct_atlas?: number
          pct_hunter?: number
          pct_performance?: number
          pct_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      hunter_users: {
        Row: {
          hunter: string
          user_id: string
        }
        Insert: {
          hunter: string
          user_id: string
        }
        Update: {
          hunter?: string
          user_id?: string
        }
        Relationships: []
      }
      info_gerais: {
        Row: {
          chave: string | null
          cliente_id: string
          id: string
          valor: string | null
        }
        Insert: {
          chave?: string | null
          cliente_id: string
          id?: string
          valor?: string | null
        }
        Update: {
          chave?: string | null
          cliente_id?: string
          id?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "info_gerais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      investimento_anuncios: {
        Row: {
          cliente_id: string
          conversas_iniciadas: number
          created_at: string
          created_by: string | null
          data: string
          id: string
          plataforma: string
          valor_investido: number
        }
        Insert: {
          cliente_id: string
          conversas_iniciadas?: number
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          plataforma: string
          valor_investido?: number
        }
        Update: {
          cliente_id?: string
          conversas_iniciadas?: number
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          plataforma?: string
          valor_investido?: number
        }
        Relationships: [
          {
            foreignKeyName: "investimento_anuncios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          alcancado: number | null
          ano: number
          cliente_id: string
          id: string
          mes: number
          meta_cirurgias: number | null
          meta_consultas: number | null
          meta_ideal: number | null
          meta_minima: number | null
          meta_vendas: number | null
          supermeta: number | null
        }
        Insert: {
          alcancado?: number | null
          ano: number
          cliente_id: string
          id?: string
          mes: number
          meta_cirurgias?: number | null
          meta_consultas?: number | null
          meta_ideal?: number | null
          meta_minima?: number | null
          meta_vendas?: number | null
          supermeta?: number | null
        }
        Update: {
          alcancado?: number | null
          ano?: number
          cliente_id?: string
          id?: string
          mes?: number
          meta_cirurgias?: number | null
          meta_consultas?: number | null
          meta_ideal?: number | null
          meta_minima?: number | null
          meta_vendas?: number | null
          supermeta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_drive_watches: {
        Row: {
          callback_url: string
          cliente_id: string
          created_at: string
          expires_at: string
          id: string
          last_error: string | null
          last_message: number
          last_version: string | null
          pending_at: string | null
          resource_id: string | null
          spreadsheet_id: string
          token_hash: string
        }
        Insert: {
          callback_url: string
          cliente_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_error?: string | null
          last_message?: number
          last_version?: string | null
          pending_at?: string | null
          resource_id?: string | null
          spreadsheet_id: string
          token_hash: string
        }
        Update: {
          callback_url?: string
          cliente_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          last_message?: number
          last_version?: string | null
          pending_at?: string | null
          resource_id?: string | null
          spreadsheet_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_drive_watches_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sync_leases: {
        Row: {
          cliente_id: string
          expires_at: string
          lease_token: string
        }
        Insert: {
          cliente_id: string
          expires_at: string
          lease_token: string
        }
        Update: {
          cliente_id?: string
          expires_at?: string
          lease_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sync_leases_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_procedimentos: {
        Row: {
          cliente_id: string
          formas_pagamento: string | null
          id: string
          permite_desconto_av: string | null
          procedimento: string
          regras_parcelamento: string | null
          sinal_percentual: string | null
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          cliente_id: string
          formas_pagamento?: string | null
          id?: string
          permite_desconto_av?: string | null
          procedimento: string
          regras_parcelamento?: string | null
          sinal_percentual?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          cliente_id?: string
          formas_pagamento?: string | null
          id?: string
          permite_desconto_av?: string | null
          procedimento?: string
          regras_parcelamento?: string | null
          sinal_percentual?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_procedimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          cliente_id: string | null
          erro: string | null
          fim: string | null
          id: string
          inicio: string
          linhas_lidas: number | null
          status: string
        }
        Insert: {
          cliente_id?: string | null
          erro?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          linhas_lidas?: number | null
          status?: string
        }
        Update: {
          cliente_id?: string | null
          erro?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          linhas_lidas?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clientes: {
        Row: {
          cliente_id: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          caixa_recebido: number | null
          cliente_id: string
          comissao_atlas: number | null
          comissao_extra: number | null
          comissao_hunter: number | null
          comparecimentos: number
          consultas: number | null
          data_cirurgia: string | null
          data_consulta: string | null
          data_venda: string | null
          id: string
          lead_nome: string
          linha_planilha: number | null
          observacoes: string | null
          orcamento: number | null
          origem: string | null
          pago_100: boolean | null
          procedimento: string | null
          status: string | null
          synced_at: string
          valor_fechado: number | null
          vendas: number | null
        }
        Insert: {
          caixa_recebido?: number | null
          cliente_id: string
          comissao_atlas?: number | null
          comissao_extra?: number | null
          comissao_hunter?: number | null
          comparecimentos?: number
          consultas?: number | null
          data_cirurgia?: string | null
          data_consulta?: string | null
          data_venda?: string | null
          id?: string
          lead_nome: string
          linha_planilha?: number | null
          observacoes?: string | null
          orcamento?: number | null
          origem?: string | null
          pago_100?: boolean | null
          procedimento?: string | null
          status?: string | null
          synced_at?: string
          valor_fechado?: number | null
          vendas?: number | null
        }
        Update: {
          caixa_recebido?: number | null
          cliente_id?: string
          comissao_atlas?: number | null
          comissao_extra?: number | null
          comissao_hunter?: number | null
          comparecimentos?: number
          consultas?: number | null
          data_cirurgia?: string | null
          data_consulta?: string | null
          data_venda?: string | null
          id?: string
          lead_nome?: string
          linha_planilha?: number | null
          observacoes?: string | null
          orcamento?: number | null
          origem?: string | null
          pago_100?: boolean | null
          procedimento?: string | null
          status?: string | null
          synced_at?: string
          valor_fechado?: number | null
          vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_portal_sync: {
        Args: { _cliente_id: string; _token: string }
        Returns: boolean
      }
      can_view_cliente: { Args: { _cliente_id: string }; Returns: boolean }
      claim_access: { Args: never; Returns: string }
      dispatch_portal_drive_worker: {
        Args: { _secret: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      receive_portal_drive_event: {
        Args: {
          _changed: boolean
          _hash: string
          _id: string
          _message: number
          _resource: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "equipe" | "cliente"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "equipe", "cliente"],
    },
  },
} as const
