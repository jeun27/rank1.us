
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
            "ai_access_checks": {
                  Row: {
                    "business_id": string | null,"checked_at": string,"cloudflare": boolean,"crawlers": Json,"domain": string,"outcome": string,"pages_checked": number,"run_id": string,"status_gptbot": number | null,"status_normal": number | null,"visible_words": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id"?: string | null,"checked_at"?: string,"cloudflare"?: boolean,"crawlers"?: Json,"domain": string,"outcome": string,"pages_checked"?: number,"run_id": string,"status_gptbot"?: number | null,"status_normal"?: number | null,"visible_words"?: number | null
                  }
                  Update: {
                    "business_id"?: string | null,"checked_at"?: string,"cloudflare"?: boolean,"crawlers"?: Json,"domain"?: string,"outcome"?: string,"pages_checked"?: number,"run_id"?: string,"status_gptbot"?: number | null,"status_normal"?: number | null,"visible_words"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_access_checks_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_access_checks_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_traffic": {
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
                    "brands": Json | null,"checked_at": string,"cost_usd": number,"engine": string,"first_position": number | null,"id": string,"job_id": string | null,"location_supported": string | null,"location_used": string | null,"mentioned": boolean | null,"question_id": string | null,"question_text_used": string,"raw": Json | null,"run_id": string,"run_index": number,"status": string,"text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brands"?: Json | null,"checked_at"?: string,"cost_usd"?: number,"engine": string,"first_position"?: number | null,"id"?: string,"job_id"?: string | null,"location_supported"?: string | null,"location_used"?: string | null,"mentioned"?: boolean | null,"question_id"?: string | null,"question_text_used": string,"raw"?: Json | null,"run_id": string,"run_index": number,"status": string,"text"?: string | null
                  }
                  Update: {
                    "brands"?: Json | null,"checked_at"?: string,"cost_usd"?: number,"engine"?: string,"first_position"?: number | null,"id"?: string,"job_id"?: string | null,"location_supported"?: string | null,"location_used"?: string | null,"mentioned"?: boolean | null,"question_id"?: string | null,"question_text_used"?: string,"raw"?: Json | null,"run_id"?: string,"run_index"?: number,"status"?: string,"text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_job_id_fkey"
      columns: ["job_id"]
isOneToOne: true
      referencedRelation: "run_jobs"
      referencedColumns: ["id"]
    },
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
                    "aliases": (string)[],"archive_at": string | null,"archived_at": string | null,"brand_color": string | null,"city": string,"country": string,"created_at": string,"cuisine": string | null,"domain": string | null,"fix_list_visible": boolean,"gas_ready_at": string | null,"gas_ready_dismissed_at": string | null,"ga4_property_id": string | null,"id": string,"logo_path": string | null,"narrative_avoid": (string)[],"narrative_want": (string)[],"name": string,"report_recipients": (string)[],"service": string,"state": string,"vertical": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"archive_at"?: string | null,"archived_at"?: string | null,"brand_color"?: string | null,"city"?: string,"country"?: string,"created_at"?: string,"cuisine"?: string | null,"domain"?: string | null,"fix_list_visible"?: boolean,"gas_ready_at"?: string | null,"gas_ready_dismissed_at"?: string | null,"ga4_property_id"?: string | null,"id"?: string,"logo_path"?: string | null,"narrative_avoid"?: (string)[],"narrative_want"?: (string)[],"name": string,"report_recipients"?: (string)[],"service"?: string,"state"?: string,"vertical"?: string,"workspace_id": string
                  }
                  Update: {
                    "aliases"?: (string)[],"archive_at"?: string | null,"archived_at"?: string | null,"brand_color"?: string | null,"city"?: string,"country"?: string,"created_at"?: string,"cuisine"?: string | null,"domain"?: string | null,"fix_list_visible"?: boolean,"gas_ready_at"?: string | null,"gas_ready_dismissed_at"?: string | null,"ga4_property_id"?: string | null,"id"?: string,"logo_path"?: string | null,"narrative_avoid"?: (string)[],"narrative_want"?: (string)[],"name"?: string,"report_recipients"?: (string)[],"service"?: string,"state"?: string,"vertical"?: string,"workspace_id"?: string
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
                },"connection_changes": {
                  Row: {
                    "actor": string,"after": Json | null,"before": Json | null,"business_id": string,"connection_id": string,"created_at": string,"field": string,"id": string,"provider_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"after"?: Json | null,"before"?: Json | null,"business_id": string,"connection_id": string,"created_at"?: string,"field": string,"id"?: string,"provider_ref"?: string | null
                  }
                  Update: {
                    "actor"?: string,"after"?: Json | null,"before"?: Json | null,"business_id"?: string,"connection_id"?: string,"created_at"?: string,"field"?: string,"id"?: string,"provider_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_changes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_changes_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_tokens": {
                  Row: {
                    "connection_id": string,"enc_access": string | null,"enc_refresh": string | null,"expires_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"enc_access"?: string | null,"enc_refresh"?: string | null,"expires_at"?: string | null
                  }
                  Update: {
                    "connection_id"?: string,"enc_access"?: string | null,"enc_refresh"?: string | null,"expires_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_tokens_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"connections": {
                  Row: {
                    "business_id": string,"connected_at": string,"connected_by": string | null,"external_account_id": string | null,"id": string,"last_checked_at": string | null,"provider": string,"scopes": (string)[],"selected_entities": Json,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"connected_at"?: string,"connected_by"?: string | null,"external_account_id"?: string | null,"id"?: string,"last_checked_at"?: string | null,"provider": string,"scopes"?: (string)[],"selected_entities"?: Json,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"connected_at"?: string,"connected_by"?: string | null,"external_account_id"?: string | null,"id"?: string,"last_checked_at"?: string | null,"provider"?: string,"scopes"?: (string)[],"selected_entities"?: Json,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connections_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"connector_interest": {
                  Row: {
                    "business_id": string,"created_at": string,"provider": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"provider": string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"provider"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connector_interest_business_id_fkey"
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
                    "business_id": string,"change_date": string | null,"change_note": string | null,"change_url": string | null,"ended_at": string | null,"fix_id": string | null,"id": string,"name": string,"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"change_date"?: string | null,"change_note"?: string | null,"change_url"?: string | null,"ended_at"?: string | null,"fix_id"?: string | null,"id"?: string,"name": string,"status"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"change_date"?: string | null,"change_note"?: string | null,"change_url"?: string | null,"ended_at"?: string | null,"fix_id"?: string | null,"id"?: string,"name"?: string,"status"?: string | null
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
                },"fix_checks": {
                  Row: {
                    "business_id": string,"created_at": string,"result": string,"rule_key": string,"run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"result": string,"rule_key": string,"run_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"result"?: string,"rule_key"?: string,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fix_checks_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fix_checks_rule_key_fkey"
      columns: ["rule_key"]
isOneToOne: false
      referencedRelation: "fix_rules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "fix_checks_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"fix_rules": {
                  Row: {
                    "ai_lever": boolean,"cadence": string,"customer_copy": string,"data_source": string | null,"detection": string | null,"enabled": boolean,"grp": string,"key": string,"pillar": string,"size": string,"threshold": Json | null,"title": string,"unverified": (string)[],"why_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_lever"?: boolean,"cadence": string,"customer_copy": string,"data_source"?: string | null,"detection"?: string | null,"enabled"?: boolean,"grp": string,"key": string,"pillar"?: string,"size": string,"threshold"?: Json | null,"title": string,"unverified"?: (string)[],"why_note"?: string | null
                  }
                  Update: {
                    "ai_lever"?: boolean,"cadence"?: string,"customer_copy"?: string,"data_source"?: string | null,"detection"?: string | null,"enabled"?: boolean,"grp"?: string,"key"?: string,"pillar"?: string,"size"?: string,"threshold"?: Json | null,"title"?: string,"unverified"?: (string)[],"why_note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"fixes": {
                  Row: {
                    "affected_answers": number | null,"business_id": string,"detail": string | null,"evidence": Json | null,"first_seen_run": string | null,"id": string,"last_seen_run": string | null,"pillar": string,"rule_key": string,"size": string,"status": string,"status_changed_at": string | null,"status_changed_by": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affected_answers"?: number | null,"business_id": string,"detail"?: string | null,"evidence"?: Json | null,"first_seen_run"?: string | null,"id"?: string,"last_seen_run"?: string | null,"pillar"?: string,"rule_key": string,"size": string,"status"?: string,"status_changed_at"?: string | null,"status_changed_by"?: string | null,"title": string
                  }
                  Update: {
                    "affected_answers"?: number | null,"business_id"?: string,"detail"?: string | null,"evidence"?: Json | null,"first_seen_run"?: string | null,"id"?: string,"last_seen_run"?: string | null,"pillar"?: string,"rule_key"?: string,"size"?: string,"status"?: string,"status_changed_at"?: string | null,"status_changed_by"?: string | null,"title"?: string
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
                },"free_audits": {
                  Row: {
                    "brands": Json,"city": string | null,"country": string,"created_at": string,"domain": string,"lead_id": string,"notified_at": string | null,"notify_attempts": number,"notify_sent": boolean | null,"run_id": string,"state": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brands": Json,"city"?: string | null,"country": string,"created_at"?: string,"domain": string,"lead_id": string,"notified_at"?: string | null,"notify_attempts"?: number,"notify_sent"?: boolean | null,"run_id": string,"state"?: string | null
                  }
                  Update: {
                    "brands"?: Json,"city"?: string | null,"country"?: string,"created_at"?: string,"domain"?: string,"lead_id"?: string,"notified_at"?: string | null,"notify_attempts"?: number,"notify_sent"?: boolean | null,"run_id"?: string,"state"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "free_audits_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: true
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "free_audits_run_id_fkey"
      columns: ["run_id"]
isOneToOne: true
      referencedRelation: "runs"
      referencedColumns: ["id"]
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
                },"lookup_cache": {
                  Row: {
                    "created_at": string,"key": string,"kind": string,"result": Json,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"kind": string,"result": Json,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"kind"?: string,"result"?: Json,"user_id"?: string
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
                    "attempts": number,"business_id": string,"id": string,"last_error": string | null,"locked_at": string | null,"pdf_path": string | null,"period_end": string,"period_start": string,"sent_at": string | null,"sent_to": (string)[],"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"business_id": string,"id"?: string,"last_error"?: string | null,"locked_at"?: string | null,"pdf_path"?: string | null,"period_end": string,"period_start": string,"sent_at"?: string | null,"sent_to"?: (string)[],"status"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"business_id"?: string,"id"?: string,"last_error"?: string | null,"locked_at"?: string | null,"pdf_path"?: string | null,"period_end"?: string,"period_start"?: string,"sent_at"?: string | null,"sent_to"?: (string)[],"status"?: string | null
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
                },"run_jobs": {
                  Row: {
                    "attempts": number,"city": string | null,"country": string | null,"created_at": string,"dfs_location_code": number | null,"engine": string,"id": string,"last_error": string | null,"location_level": string | null,"locked_at": string | null,"question_id": string | null,"question_text": string | null,"run_id": string,"run_index": number,"run_kind": string,"state": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"city"?: string | null,"country"?: string | null,"created_at"?: string,"dfs_location_code"?: number | null,"engine": string,"id"?: string,"last_error"?: string | null,"location_level"?: string | null,"locked_at"?: string | null,"question_id"?: string | null,"question_text"?: string | null,"run_id": string,"run_index": number,"run_kind": string,"state"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"city"?: string | null,"country"?: string | null,"created_at"?: string,"dfs_location_code"?: number | null,"engine"?: string,"id"?: string,"last_error"?: string | null,"location_level"?: string | null,"locked_at"?: string | null,"question_id"?: string | null,"question_text"?: string | null,"run_id"?: string,"run_index"?: number,"run_kind"?: string,"state"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_jobs_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_jobs_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_jobs_run_kind_fkey"
      columns: ["run_id","run_kind"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id","kind"]
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
                    "created_at": string,"id": string,"name": string,"owner_id": string,"seats_quantity": number,"stripe_current_period_end": string | null,"stripe_customer_id": string | null,"stripe_event_at": string | null,"stripe_subscription_id": string | null,"subscription_status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id": string,"seats_quantity"?: number,"stripe_current_period_end"?: string | null,"stripe_customer_id"?: string | null,"stripe_event_at"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"seats_quantity"?: number,"stripe_current_period_end"?: string | null,"stripe_customer_id"?: string | null,"stripe_event_at"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null
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
            "add_competitor":
{ Args: { "p": Json,"p_business_id": string }; Returns: string
                           },
"apply_stripe_subscription":
{ Args: { "p": Json }; Returns: string
                           },
"archive_scheduled_businesses":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"bump_free_audit_notify_attempts":
{ Args: { "p_run_id": string }; Returns: number
                           },
"can_apply_edits":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"can_connect_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"can_write_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"cancel_business_removal":
{ Args: { "p_business_id": string }; Returns: undefined
                           },
"claim_jobs":
{ Args: { "p_limit": number }; Returns: Json[]
                           },
"claim_reports":
{ Args: { "p_limit": number }; Returns: Json[]
                           },
"client_invite_status":
{ Args: { "p_business_id": string,"p_email": string }; Returns: string
                           },
"create_business_onboarding":
{ Args: { "p": Json }; Returns: string
                           },
"create_dfy_client":
{ Args: { "p": Json }; Returns: Json
                           },
"create_experiment":
{ Args: { "p": Json }; Returns: string
                           },
"create_free_audit":
{ Args: { "p": Json }; Returns: string
                           },
"create_run":
{ Args: { "p_business_id": string,"p_kind": string }; Returns: string
                           },
"dismiss_competitor":
{ Args: { "p": Json,"p_business_id": string }; Returns: string
                           },
"dismiss_gas_ready":
{ Args: { "p_business_id": string }; Returns: undefined
                           },
"done_fixes":
{ Args: { "p_business_id": string }; Returns: { "changed_by": Json,"detail": string | null,"id": string,"pillar": string,"rule_key": string,"status_changed_at": string | null,"title": string }[]
                           },
"end_experiment":
{ Args: { "p_experiment_id": string }; Returns: boolean
                           },
"enqueue_monthly_reports":
{ Args: { "p_month": string }; Returns: Json
                           },
"enqueue_weekly_runs":
{ Args: { "p_week_start": string }; Returns: Json
                           },
"experiment_data":
{ Args: { "p_experiment_id": string }; Returns: { "ends": string,"grp": string,"n": number,"named": number,"period": string,"starts": string }[]
                           },
"ensure_self_serve_workspace":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"finish_job":
{ Args: { "p_answer": Json,"p_citations": Json,"p_job_id": string }; Returns: undefined
                           },
"finish_report":
{ Args: { "p_error": string | null,"p_pdf_path": string | null,"p_report_id": string,"p_sent_to": string[] | null,"p_status": string }; Returns: boolean
                           },
"gas_ready":
{ Args: { "p_business_id": string }; Returns: { "ready_at": string | null,"show_notice": boolean }[]
                           },
"get_connection_tokens":
{ Args: { "p_connection_id": string }; Returns: { "enc_access": string | null,"enc_refresh": string | null,"expires_at": string | null,"external_account_id": string | null,"status": string }[]
                           },
"grant_dfy_client":
{ Args: { "p_business_id": string,"p_user_id": string }; Returns: string
                           },
"job_error":
{ Args: { "p_error": string,"p_job_id": string }; Returns: undefined
                           },
"list_client_users":
{ Args: { "p_business_id": string }; Returns: { "added_at": string,"email": string,"signed_in": boolean,"user_id": string }[]
                           },
"my_landing":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"note_connector_interest":
{ Args: { "p_business_id": string,"p_provider": string }; Returns: undefined
                           },
"open_fix_actors":
{ Args: { "p_business_id": string }; Returns: { "changed_by": Json,"id": string,"status_changed_at": string | null }[]
                           },
"prune_ephemeral":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"record_ai_access_check":
{ Args: { "p": Json,"p_run_id": string }; Returns: undefined
                           },
"record_connection_change":
{ Args: { "p_actor": string,"p_after": Json,"p_before": Json,"p_connection_id": string,"p_field": string,"p_provider_ref": string }; Returns: string
                           },
"record_stripe_event":
{ Args: { "p_event_id": string,"p_type": string }; Returns: boolean
                           },
"record_fix_results":
{ Args: { "p_business_id": string,"p_results": Json,"p_run_id": string }; Returns: undefined
                           },
"refresh_gas_ready":
{ Args: { "p_business_id": string,"p_recommended": string[] }; Returns: Json
                           },
"revoke_dfy_client":
{ Args: { "p_business_id": string,"p_user_id": string }; Returns: boolean
                           },
"revoke_connection":
{ Args: { "p_connection_id": string }; Returns: string[]
                           },
"run_summaries":
{ Args: { "p_business_id": string,"p_limit"?: number,"p_statuses"?: string[] }; Returns: { "finished_at": string | null,"jobs_failed": number,"jobs_ok": number,"jobs_total": number,"kind": string,"n": number,"named": number,"per_engine": Json,"run_id": string,"started_at": string | null,"status": string }[]
                           },
"runs_needing_fix_checks":
{ Args: { "p_limit"?: number }; Returns: { "business_id": string,"domain": string | null,"run_id": string }[]
                           },
"save_connection":
{ Args: { "p_business_id": string,"p_connected_by": string,"p_enc_access": string,"p_enc_refresh": string,"p_expires_at": string,"p_external_account_id": string,"p_provider": string,"p_scopes": string[] }; Returns: string
                           },
"schedule_business_removal":
{ Args: { "p_at": string,"p_business_id": string }; Returns: undefined
                           },
"set_connection_entities":
{ Args: { "p_connection_id": string,"p_entities": Json }; Returns: undefined
                           },
"set_connection_status":
{ Args: { "p_connection_id": string,"p_status": string }; Returns: undefined
                           },
"set_fix_list_visible":
{ Args: { "p_business_id": string,"p_visible": boolean }; Returns: undefined
                           },
"set_fix_status":
{ Args: { "p_fix_id": string,"p_status": string }; Returns: undefined
                           },
"set_narrative_words":
{ Args: { "p_avoid": string[],"p_business_id": string,"p_want": string[] }; Returns: undefined
                           },
"set_report_settings":
{ Args: { "p_brand_color": string | null,"p_business_id": string,"p_report_recipients": string[] }; Returns: undefined
                           },
"take_rate_token":
{ Args: { "p_kind": string }; Returns: boolean
                           },
"update_connection_tokens":
{ Args: { "p_connection_id": string,"p_enc_access": string,"p_enc_refresh"?: string,"p_expires_at": string }; Returns: undefined
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
