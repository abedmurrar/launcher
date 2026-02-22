export interface CommandFormData {
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
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
};
