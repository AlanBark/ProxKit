import { useState } from "react";
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input,
} from "@heroui/react";

interface SaveProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => Promise<boolean>;
    isBusy: boolean;
}

/** Characters a filename cannot contain on Windows. */
const ILLEGAL = /[/\\:*?"<>|]/;

/**
 * Names a project so it can be saved.
 *
 * Naming is the moment a project stops being scratch work and starts being
 * kept, so it is also the moment autosave takes over.
 */
export function SaveProjectModal({ isOpen, onClose, onSave, isBusy }: SaveProjectModalProps) {
    const [name, setName] = useState("");

    const trimmed = name.trim();
    const problem = !trimmed
        ? null
        : ILLEGAL.test(trimmed)
          ? 'A name cannot contain / \\ : * ? " < > |'
          : null;

    const commit = async () => {
        if (!trimmed || problem) return;
        if (await onSave(trimmed)) {
            setName("");
            onClose();
        }
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
                        onValueChange={setName}
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
                        isDisabled={!trimmed || !!problem || isBusy}
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
