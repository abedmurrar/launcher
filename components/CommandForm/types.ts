export interface CommandFormData {
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  /** Restart automatically after a reboot / launcher crash */
  autoRestart: boolean;
}

export interface CommandFormProps {
  initial?: Partial<CommandFormData>;
  onSubmit: (data: CommandFormData) => Promise<void>;
  onCancel?: () => void;
}

export const emptyForm: CommandFormData = {
  name: "",
  command: "",
  cwd: "",
  env: {},
  autoRestart: false,
};
