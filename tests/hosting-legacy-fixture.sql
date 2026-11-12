-- Fictional legacy baseline, used only in disposable localhost hosting tests.
ALTER TABLE departments ADD COLUMN parent_id uuid REFERENCES departments(id), ADD COLUMN manager_id uuid REFERENCES users(id);
CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE task_checklist_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE task_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE task_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE chat_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE chat_participants(conversation_id uuid REFERENCES chat_conversations(id), user_id uuid REFERENCES users(id), PRIMARY KEY(conversation_id,user_id));
CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid REFERENCES users(id));
CREATE TABLE user_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), revoked_at timestamptz, expires_at timestamptz);
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id));
