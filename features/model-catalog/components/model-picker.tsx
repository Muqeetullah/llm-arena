"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatContextWindow,
  modelInitials,
  providerName,
  type ModelOption,
} from "@/features/model-catalog/types";

const MAX_SELECTED_MODELS = 3;

type ModelPickerProps = {
  readonly catalogError: string | null;
  readonly models: readonly ModelOption[];
  readonly selectedModelIds: readonly string[];
  readonly onSelect: (modelId: string) => void;
};

export function ModelPicker({
  catalogError,
  models,
  selectedModelIds,
  onSelect,
}: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const availableModels = useMemo(
    () => models.filter((model) => !selectedModelIds.includes(model.id)),
    [models, selectedModelIds],
  );
  const isAtLimit = selectedModelIds.length >= MAX_SELECTED_MODELS;
  const isUnavailable = Boolean(catalogError) || models.length === 0;
  const isDisabled = isAtLimit || isUnavailable || availableModels.length === 0;
  const disabledReason = isAtLimit
    ? "Three models selected"
    : catalogError
      ? "Model catalog unavailable"
      : "No more models available";

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);

    if (!nextOpen) {
      setQuery("");
    }
  }

  function selectModel(modelId: string) {
    onSelect(modelId);

    if (selectedModelIds.length + 1 >= MAX_SELECTED_MODELS) {
      handleOpenChange(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className="add-model"
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDisabled}
          aria-label={isDisabled ? disabledReason : "Add a model"}
          title={isDisabled ? disabledReason : undefined}
        >
          <Plus size={14} />
          Add model
          <span className="model-limit" aria-hidden="true">
            {selectedModelIds.length}/{MAX_SELECTED_MODELS}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="model-picker-content"
        align="start"
        side="top"
        sideOffset={10}
      >
        <PopoverHeader className="model-picker-header">
          <PopoverTitle>Choose a model</PopoverTitle>
          <PopoverDescription>
            Free text models, ordered by context window.
          </PopoverDescription>
        </PopoverHeader>

        <Command className="model-picker-command" shouldFilter>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search models or providers"
            aria-label="Search available models"
          />
          <CommandList className="model-picker-list">
            <CommandEmpty>No available models match that search.</CommandEmpty>
            <CommandGroup heading={`${availableModels.length} available`}>
              {availableModels.map((model) => (
                <CommandItem
                  className="model-picker-item"
                  key={model.id}
                  value={`${model.name} ${model.author} ${model.id}`}
                  onSelect={() => selectModel(model.id)}
                >
                  <span className="model-picker-avatar" aria-hidden="true">
                    {modelInitials(model.name)}
                  </span>
                  <span className="model-picker-identity">
                    <strong>{model.name}</strong>
                    <span>
                      {providerName(model.author)} · {model.id}
                    </span>
                  </span>
                  <span className="model-picker-context">
                    {formatContextWindow(model.contextLength)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
