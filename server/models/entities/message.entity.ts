import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "messages" })
export class MessageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;
}
