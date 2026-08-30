import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { LibraryFolderSetting } from './LibraryFolderSetting';
import { ProjectsFolderSetting } from './ProjectsFolderSetting';
import { ThemeSetting } from './ThemeSetting';
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

                <ModalBody className="gap-5">
                    <ThemeSetting />

                    {isTauri && (
                        <>
                            <LibraryFolderSetting />
                            <ProjectsFolderSetting />
                        </>
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
