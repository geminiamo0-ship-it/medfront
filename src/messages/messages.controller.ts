import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a message to another student' })
  async sendMessage(
    @Request() req,
    @Body() body: { receiverId: number; content: string },
  ) {
    return this.messagesService.sendMessage(req.user.id, body.receiverId, body.content);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of conversations' })
  async getConversations(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get my message inbox (legacy)' })
  async getInbox(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }

  @Get('history/:otherUserId')
  @ApiOperation({ summary: 'Get history with a specific user' })
  async getHistory(
    @Request() req,
    @Param('otherUserId', ParseIntPipe) otherUserId: number
  ) {
    return this.messagesService.getConversationMessages(req.user.id, otherUserId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  async markAsRead(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.messagesService.markAsRead(req.user.id, id);
  }
}
