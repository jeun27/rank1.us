
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_traffic": {
                  Row: {
                    "business_id": string,"date": string,"sessions": number,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"date": string,"sessions"?: number,"source": string
                  }
                  Update: {
                    "business_id"?: string,"date"?: string,"sessions"?: number,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_traffic_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"answers": {
                  Row: {
                    "brands": Json | null,"checked_at": string,"cost_usd": number,"engine": string,"first_position": number | null,"id": string,"location_supported": string | null,"location_used": string | null,"mentioned": boolean | null,"question_id": string | null,"question_text_used": string,"raw": Json | null,"run_id": string,"run_index": number,"status": string,"text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brands"?: Json | null,"checked_at"?: string,"cost_usd"?: number,"engine": string,"first_position"?: number | null,"id"?: string,"location_supported"?: string | null,"location_used"?: string | null,"mentioned"?: boolean | null,"question_id"?: string | null,"question_text_used": string,"raw"?: Json | null,"run_id": string,"run_index": number,"status": string,"text"?: string | null
                  }
                  Update: {
                    "brands"?: Json | null,"checked_at"?: string,"cost_usd"?: number,"engine"?: string,"first_position"?: number | null,"id"?: string,"location_supported"?: string | null,"location_used"?: string | null,"mentioned"?: boolean | null,"question_id"?: string | null,"question_text_used"?: string,"raw"?: Json | null,"run_id"?: string,"run_index"?: number,"status"?: string,"text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "aliases": (string)[],"archived_at": string | null,"brand_color": string | null,"city": string,"country": string,"cuisine": string | null,"domain": string | null,"fix_list_visible": boolean,"ga4_property_id": string | null,"id": string,"logo_path": string | null,"name": string,"report_recipients": (string)[],"service": string,"state": string,"vertical": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"archived_at"?: string | null,"brand_color"?: string | null,"city"?: string,"country"?: string,"cuisine"?: string | null,"domain"?: string | null,"fix_list_visible"?: boolean,"ga4_property_id"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"report_recipients"?: (string)[],"service"?: string,"state"?: string,"vertical"?: string,"workspace_id": string
                  }
                  Update: {
                    "aliases"?: (string)[],"archived_at"?: string | null,"brand_color"?: string | null,"city"?: string,"country"?: string,"cuisine"?: string | null,"domain"?: string | null,"fix_list_visible"?: boolean,"ga4_property_id"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"report_recipients"?: (string)[],"service"?: string,"state"?: string,"vertical"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "businesses_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"citations": {
                  Row: {
                    "answer_id": string,"category": string | null,"domain": string,"id": string,"position": number | null,"title": string | null,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_id": string,"category"?: string | null,"domain": string,"id"?: string,"position"?: number | null,"title"?: string | null,"url": string
                  }
                  Update: {
                    "answer_id"?: string,"category"?: string | null,"domain"?: string,"id"?: string,"position"?: number | null,"title"?: string | null,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "citations_answer_id_fkey"
      columns: ["answer_id"]
isOneToOne: false
      referencedRelation: "answers"
      referencedColumns: ["id"]
    }
                  ]
                },"competitors": {
                  Row: {
                    "aliases": (string)[],"business_id": string,"domain": string | null,"hidden": boolean,"id": string,"maps_cid": string | null,"name": string,"rating": number | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"business_id": string,"domain"?: string | null,"hidden"?: boolean,"id"?: string,"maps_cid"?: string | null,"name": string,"rating"?: number | null,"source": string
                  }
                  Update: {
                    "aliases"?: (string)[],"business_id"?: string,"domain"?: string | null,"hidden"?: boolean,"id"?: string,"maps_cid"?: string | null,"name"?: string,"rating"?: number | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competitors_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_requests": {
                  Row: {
                    "company": string | null,"created_at": string,"email": string,"emailed": boolean,"id": string,"industry": string,"industry_other": string | null,"ip_hash": string | null,"message": string | null,"name": string,"tier": string | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company"?: string | null,"created_at"?: string,"email": string,"emailed"?: boolean,"id"?: string,"industry": string,"industry_other"?: string | null,"ip_hash"?: string | null,"message"?: string | null,"name": string,"tier"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "company"?: string | null,"created_at"?: string,"email"?: string,"emailed"?: boolean,"id"?: string,"industry"?: string,"industry_other"?: string | null,"ip_hash"?: string | null,"message"?: string | null,"name"?: string,"tier"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"domain_categories": {
                  Row: {
                    "category": string,"domain": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"domain": string,"source": string
                  }
                  Update: {
                    "category"?: string,"domain"?: string,"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"experiment_questions": {
                  Row: {
                    "experiment_id": string,"grp": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "experiment_id": string,"grp": string,"question_id": string
                  }
                  Update: {
                    "experiment_id"?: string,"grp"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "experiment_questions_experiment_id_fkey"
      columns: ["experiment_id"]
isOneToOne: false
      referencedRelation: "experiments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "experiment_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"experiments": {
                  Row: {
                    "business_id": string,"change_date": string | null,"change_note": string | null,"change_url": string | null,"fix_id": string | null,"id": string,"name": string,"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"change_date"?: string | null,"change_note"?: string | null,"change_url"?: string | null,"fix_id"?: string | null,"id"?: string,"name": string,"status"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"change_date"?: string | null,"change_note"?: string | null,"change_url"?: string | null,"fix_id"?: string | null,"id"?: string,"name"?: string,"status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "experiments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "experiments_fix_id_fkey"
      columns: ["fix_id"]
isOneToOne: false
      referencedRelation: "fixes"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_rules": {
                  Row: {
                    "ai_lever": boolean,"cadence": string,"customer_copy": string,"data_source": string | null,"detection": string | null,"enabled": boolean,"grp": string,"key": string,"size": string,"threshold": Json | null,"title": string,"unverified": (string)[],"why_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_lever"?: boolean,"cadence": string,"customer_copy": string,"data_source"?: string | null,"detection"?: string | null,"enabled"?: boolean,"grp": string,"key": string,"size": string,"threshold"?: Json | null,"title": string,"unverified"?: (string)[],"why_note"?: string | null
                  }
                  Update: {
                    "ai_lever"?: boolean,"cadence"?: string,"customer_copy"?: string,"data_source"?: string | null,"detection"?: string | null,"enabled"?: boolean,"grp"?: string,"key"?: string,"size"?: string,"threshold"?: Json | null,"title"?: string,"unverified"?: (string)[],"why_note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"fixes": {
                  Row: {
                    "affected_answers": number,"business_id": string,"detail": string | null,"evidence": Json | null,"first_seen_run": string | null,"id": string,"last_seen_run": string | null,"rule_key": string,"size": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affected_answers"?: number,"business_id": string,"detail"?: string | null,"evidence"?: Json | null,"first_seen_run"?: string | null,"id"?: string,"last_seen_run"?: string | null,"rule_key": string,"size": string,"status"?: string,"title": string
                  }
                  Update: {
                    "affected_answers"?: number,"business_id"?: string,"detail"?: string | null,"evidence"?: Json | null,"first_seen_run"?: string | null,"id"?: string,"last_seen_run"?: string | null,"rule_key"?: string,"size"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fixes_first_seen_run_fkey"
      columns: ["first_seen_run"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fixes_last_seen_run_fkey"
      columns: ["last_seen_run"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fixes_rule_key_fkey"
      columns: ["rule_key"]
isOneToOne: false
      referencedRelation: "fix_rules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "fixes_rule_key_fkey"
      columns: ["rule_key"]
isOneToOne: false
      referencedRelation: "fix_rules_public"
      referencedColumns: ["key"]
    }
                  ]
                },"google_tokens": {
                  Row: {
                    "business_id": string,"created_at": string,"refresh_token_enc": string,"scope": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"refresh_token_enc": string,"scope"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"refresh_token_enc"?: string,"scope"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "google_tokens_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "created_at": string,"domain": string | null,"email": string,"id": string,"ip_hash": string | null,"run_id": string | null,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain"?: string | null,"email": string,"id"?: string,"ip_hash"?: string | null,"run_id"?: string | null,"token": string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string | null,"email"?: string,"id"?: string,"ip_hash"?: string | null,"run_id"?: string | null,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_snapshots": {
                  Row: {
                    "business_id": string,"data": NonNullable<Json>,"fetched_at": string,"id": string,"source": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"data"?: NonNullable<Json>,"fetched_at"?: string,"id"?: string,"source": string,"url"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"data"?: NonNullable<Json>,"fetched_at"?: string,"id"?: string,"source"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_snapshots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"local_places": {
                  Row: {
                    "city": string,"id": string,"kind": string,"name": string,"state": string,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"id"?: string,"kind": string,"name": string,"state": string,"verified"?: boolean
                  }
                  Update: {
                    "city"?: string,"id"?: string,"kind"?: string,"name"?: string,"state"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"question_templates": {
                  Row: {
                    "fixed_city": string | null,"fixed_cuisine": string | null,"id": string,"long_form": string,"origin": string | null,"short_form": string,"slots": (string)[],"sort": number,"vertical": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fixed_city"?: string | null,"fixed_cuisine"?: string | null,"id"?: string,"long_form": string,"origin"?: string | null,"short_form": string,"slots"?: (string)[],"sort"?: number,"vertical"?: string
                  }
                  Update: {
                    "fixed_city"?: string | null,"fixed_cuisine"?: string | null,"id"?: string,"long_form"?: string,"origin"?: string | null,"short_form"?: string,"slots"?: (string)[],"sort"?: number,"vertical"?: string
                  }
                  Relationships: [
                    
                  ]
                },"questions": {
                  Row: {
                    "active": boolean,"active_form": string,"business_id": string,"city": string | null,"country": string | null,"dfs_location_code": number | null,"id": string,"location_level": string,"long_text": string | null,"short_text": string,"state": string | null,"template_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"active_form"?: string,"business_id": string,"city"?: string | null,"country"?: string | null,"dfs_location_code"?: number | null,"id"?: string,"location_level": string,"long_text"?: string | null,"short_text": string,"state"?: string | null,"template_key"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"active_form"?: string,"business_id"?: string,"city"?: string | null,"country"?: string | null,"dfs_location_code"?: number | null,"id"?: string,"location_level"?: string,"long_text"?: string | null,"short_text"?: string,"state"?: string | null,"template_key"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_events": {
                  Row: {
                    "created_at": string,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"kind": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "business_id": string,"id": string,"pdf_path": string | null,"period_end": string,"period_start": string,"sent_at": string | null,"sent_to": (string)[],"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"id"?: string,"pdf_path"?: string | null,"period_end": string,"period_start": string,"sent_at"?: string | null,"sent_to"?: (string)[],"status"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"id"?: string,"pdf_path"?: string | null,"period_end"?: string,"period_start"?: string,"sent_at"?: string | null,"sent_to"?: (string)[],"status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"runs": {
                  Row: {
                    "business_id": string | null,"cost_usd": number,"finished_at": string | null,"id": string,"jobs_failed": number,"jobs_ok": number,"jobs_total": number,"kind": string,"started_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id"?: string | null,"cost_usd"?: number,"finished_at"?: string | null,"id"?: string,"jobs_failed"?: number,"jobs_ok"?: number,"jobs_total"?: number,"kind": string,"started_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "business_id"?: string | null,"cost_usd"?: number,"finished_at"?: string | null,"id"?: string,"jobs_failed"?: number,"jobs_ok"?: number,"jobs_total"?: number,"kind"?: string,"started_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "runs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "event_id": string,"processed_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"processed_at"?: string,"type": string
                  }
                  Update: {
                    "event_id"?: string,"processed_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_id": string,"seats_quantity": number,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"subscription_status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id": string,"seats_quantity"?: number,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"seats_quantity"?: number,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "fix_rules_public": {
                  Row: {
                    "ai_lever": boolean,"cadence": string,"customer_copy": string,"data_source": string | null,"detection": string | null,"enabled": boolean,"grp": string,"key": string,"size": string,"threshold": Json | null,"title": string,"unverified": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                           "ai_lever"?: boolean | null,"cadence"?: string | null,"customer_copy"?: string | null,"data_source"?: string | null,"detection"?: string | null,"enabled"?: boolean | null,"grp"?: string | null,"key"?: string | null,"size"?: string | null,"threshold"?: Json | null,"title"?: string | null,"unverified"?: (string)[] | null
                         }
                        Update: {
                           "ai_lever"?: boolean | null,"cadence"?: string | null,"customer_copy"?: string | null,"data_source"?: string | null,"detection"?: string | null,"enabled"?: boolean | null,"grp"?: string | null,"key"?: string | null,"size"?: string | null,"threshold"?: Json | null,"title"?: string | null,"unverified"?: (string)[] | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "create_business_onboarding":
{ Args: { "p": Json }; Returns: string
                           },
"create_dfy_client":
{ Args: { "p": Json }; Returns: Json
                           },
"ensure_self_serve_workspace":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_landing":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"take_rate_token":
{ Args: { "p_kind": string,"p_max": number,"p_window": unknown }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
