use sea_orm::entity::prelude::*;

/// The current balance, cached. Not the source of truth — `credit_ledger`
/// is — this exists so the hot path (can this call keep running?) checks
/// one row instead of summing history on every frame. Kept in sync with
/// `credit_ledger` by incrementing/decrementing in the same transaction as
/// each ledger insert.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "credit_balances")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: Uuid,
    pub balance_credits: i64,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UserId",
        to = "super::users::Column::Id",
        on_delete = "Cascade"
    )]
    Users,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
