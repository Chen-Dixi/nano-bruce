interface UserMessageProps {
  content: string;
}

export function UserMessage(props: UserMessageProps) {
  return (
    <box
      width="100%"
      flexDirection="row"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <box width={1} backgroundColor="#89b4fa" />
      <box flexGrow={1}>
        <text fg="#cdd6f4" wrapMode="word">
          {props.content}
        </text>
      </box>
    </box>
  );
}
