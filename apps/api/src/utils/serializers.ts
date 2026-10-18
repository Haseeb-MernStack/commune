import type { Types } from "mongoose";
import type { CommentDTO, PostDTO, PublicUser } from "@commune/shared";

interface UserLike {
  _id: Types.ObjectId;
  username: string;
  bio?: string | null;
  createdAt: Date;
}

export interface PopulatedPost {
  _id: Types.ObjectId;
  content: string;
  author: { _id: Types.ObjectId; username: string };
  likeCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface PopulatedComment {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  content: string;
  author: { _id: Types.ObjectId; username: string };
  createdAt: Date;
}

export function toPublicUser(u: UserLike): PublicUser {
  return {
    id: u._id.toString(),
    username: u.username,
    bio: u.bio ?? "",
    createdAt: u.createdAt.toISOString(),
  };
}

export function toPostDTO(p: PopulatedPost, likedByMe: boolean): PostDTO {
  return {
    id: p._id.toString(),
    content: p.content,
    author: { id: p.author._id.toString(), username: p.author.username },
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    likedByMe,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toCommentDTO(c: PopulatedComment): CommentDTO {
  return {
    id: c._id.toString(),
    postId: c.post.toString(),
    content: c.content,
    author: { id: c.author._id.toString(), username: c.author.username },
    createdAt: c.createdAt.toISOString(),
  };
}
