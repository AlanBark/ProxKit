import { useState } from "react";
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input,
} from "@heroui/react";

interface SaveProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Returns an error message, or null once saved. */
    onSave: (name: string) => Promise<string | null>;
    isBusy: boolean;
}

/** Characters a filename cannot contain on Windows. */
const ILLEGAL = /[/\\:*?"<>|]/;
const ILLEGAL_MESSAGE = "A name cannot contain / \\ : * ? \" < > |";

/**
 * Names a project so it can be saved.
 *
 * Naming is the moment a project stops being scratch work and starts being
 * kept, so it is also the moment autosave takes over.
 */
export function SaveProjectModal({ isOpen, onClose, onSave, isBusy }: SaveProjectModalProps) {
    const [name, setName] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);

    const trimmed = name.trim();
    const hasIllegal = ILLEGAL.test(trimmed);
    const problem = !trimmed
        ? null
        : hasIllegal
          ? ILLEGAL_MESSAGE
          : saveError;

    const commit = async () => {
        if (!trimmed || hasIllegal) return;

        const error = await onSave(trimmed);
        if (error) {
            // Shown against the field so the name can be corrected in place.
            setSaveError(error);
            return;
        }
        setName("");
        setSaveError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" className="border-1">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    Save Project
                    <span className="text-xs font-normal text-default-500">
                        Once named, changes are saved automatically.
                    </span>
                </ModalHeader>

                <ModalBody>
                    <Input
                        autoFocus
                        label="Project name"
                        placeholder="Modern Burn"
                        value={name}
                        onValueChange={(value) => {
                            setName(value);
                            setSaveError(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void commit();
                        }}
                        isInvalid={!!problem}
                        errorMessage={problem}
                        variant="flat"
                        radius="sm"
                        labelPlacement="outside"
                    />
                </ModalBody>

                <ModalFooter>
                    <Button variant="light" radius="sm" onPress={onClose}>
                        Cancel
                    </Button>
                    <Button
                        color="success"
                        variant="ghost"
                        radius="sm"
                        isDisabled={!trimmed || hasIllegal || isBusy}
                        isLoading={isBusy}
                        onPress={commit}
                    >
                        Save
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
