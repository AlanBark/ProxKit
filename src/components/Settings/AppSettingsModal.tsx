import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { LibraryFolderSetting } from './LibraryFolderSetting';
import { isTauri } from '../../utils/platform';

interface AppSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Settings that belong to this installation rather than the current card list.
 *
 * Kept separate from the sidebar, which configures the print job itself - these
 * persist across projects and are changed rarely.
 */
export function AppSettingsModal({ isOpen, onClose }: AppSettingsModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" className="border-1">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    Application Settings
                </ModalHeader>

                <ModalBody>
                    {isTauri ? (
                        <LibraryFolderSetting />
                    ) : (
                        <p className="text-sm text-default-600">
                            There are no application settings in the browser version.
                        </p>
                    )}
                </ModalBody>

                <ModalFooter>
                    <Button variant="ghost" radius="sm" onPress={onClose}>
                        Done
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
