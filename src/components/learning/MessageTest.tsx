import React from 'react';

interface MessageProps {
    content: string;
    isUser: boolean;
    accentColor?: string;
    isMarkdown?: boolean;
    conversationContext?: {
        conversationId: string;
        courseId: string;
        moduleId: string;
        messages: any[];
        title?: string;
    }
}

const MessageTest: React.FC<MessageProps> = ({ content, isUser, accentColor, isMarkdown, conversationContext }) => {
    console.log(content);
    console.log(conversationContext);


    
    return (
        <div>
            <h1>Message Test</h1>
        </div>
    );
};

export default React.memo(MessageTest);
